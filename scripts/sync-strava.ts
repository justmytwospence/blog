/**
 * Sync the whitelisted Strava activities into the committed repo snapshot.
 *
 *   - Whitelist = the Strava ids referenced by content/adventures/*.md companion files.
 *   - CHANGE DETECTION IS CHEAP: one summary crawl (~a handful of GETs) yields a `summaryHash` per
 *     activity; only ids whose hash diverges from the committed snapshot (or are new/forced) get a
 *     per-activity detail fetch (+ streams + photos + weather). Unchanged ids cost ZERO detail calls.
 *   - Snapshots missing the hash (pre-schema) are backfilled from the summary crawl — no detail call.
 *   - GC orphaned activities/photos, rebuild the index + totals. Persist a rotated refresh token.
 *
 * Flags:
 *   --only <id[,id]>     sync exactly these ids (skip the whitelist scan + summary crawl) — O(1) for
 *                        adding one adventure. Wired into the new-adventure skill.
 *   --force              re-fetch + rewrite every target regardless of hash (also regenerates thumbs).
 *   --reindex            rebuild the all-activity index from full history.
 *   --retry-enrichment   for unchanged snapshots missing weather/location (but with known coords),
 *                        re-run the non-Strava enrichment only; idempotent (writes only if it fills).
 *   --prune-all          allow GC to wipe the snapshot when no companion references anything.
 *
 * Run: npm run sync:strava [-- <flags>]   (reads .env.local). A description-only Strava edit does not
 * move `summaryHash`; reconcile those with `--force` or `--only <id>`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import sharp from 'sharp';
import {
  mintAccessToken,
  getActivityDetail,
  getActivityStreams,
  getActivityPhotos,
  fetchHistoricalWeather,
  transformDetailToActivity,
  buildPhotosFromRaw,
  decodePolyline,
  reverseGeocode,
  pageRawSummaries,
  type RawDetailedActivity,
  type RawSummaryActivity,
  type AdventureActivity,
  type AdventurePhoto,
  type AdventureWeather,
} from '@blog/strava';
import {
  ACTIVITIES_DIR,
  PUBLIC_DIR,
  getCreds,
  loadEnvLocal,
  persistRefreshToken,
  readCompanions,
  sleep,
  summaryHash,
  withBackoff,
} from './strava-shared';
import { buildRouteThumb } from './route-thumb';
import { refreshIndex } from './build-index';
import { writeTotals } from './build-totals';

const SCHEMA_VERSION = 1;
const PACING_MS = 300;
const FORCE = process.argv.includes('--force');
const RETRY_ENRICHMENT = process.argv.includes('--retry-enrichment');

/** Detail-level fingerprint (includes `description`) — decides whether to rewrite the snapshot. */
function sourceHash(detail: RawDetailedActivity): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        v: SCHEMA_VERSION,
        id: detail.id,
        name: detail.name,
        distance: detail.distance,
        moving_time: detail.moving_time,
        gain: detail.total_elevation_gain,
        start: detail.start_date ?? detail.start_date_local,
        poly: detail.map?.summary_polyline ?? null,
        photos: detail.total_photo_count ?? null,
        sport: detail.sport_type ?? detail.type,
        desc: detail.description ?? null,
      }),
    )
    .digest('hex');
}

/** Parse `--only <csv>` into a set of ids, or null when the flag is absent. */
function parseOnly(): Set<number> | null {
  const i = process.argv.indexOf('--only');
  if (i === -1) return null;
  const raw = process.argv[i + 1] ?? '';
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

function readSnapshot(p: string): AdventureActivity | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as AdventureActivity;
  } catch {
    return null;
  }
}

/** Snapshots (transform + backfill) are written with 2-space JSON and NO trailing newline. */
function writeSnapshot(p: string, activity: AdventureActivity): void {
  fs.writeFileSync(p, JSON.stringify(activity, null, 2));
}

async function downloadPhotos(
  photos: AdventurePhoto[],
  dir: string,
): Promise<{ photos: AdventurePhoto[]; fetched: number }> {
  if (photos.length === 0) return { photos: [], fetched: 0 };
  fs.mkdirSync(dir, { recursive: true });
  const out: AdventurePhoto[] = [];
  let fetched = 0;
  const nonEmpty = (p: string): boolean => fs.existsSync(p) && fs.statSync(p).size > 0;
  for (const ph of photos) {
    const safe = ph.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const base = `photo-${safe}`;
    const displayPath = path.join(dir, `${base}.jpg`);
    const thumbPath = path.join(dir, `${base}-thumb.jpg`);
    try {
      if (!nonEmpty(displayPath) || !nonEmpty(thumbPath)) {
        const res = await fetch(ph.sourceUrl);
        if (!res.ok) {
          console.error(`[strava] photo ${ph.id} download ${res.status}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) {
          console.error(`[strava] photo ${ph.id} empty body`);
          continue;
        }
        // Write to temp paths then rename, so a crash mid-write never leaves a truncated
        // file that the presence check would later treat as a complete download.
        const dTmp = `${displayPath}.tmp`;
        const tTmp = `${thumbPath}.tmp`;
        await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toFile(dTmp);
        await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 72, progressive: true }).toFile(tTmp);
        fs.renameSync(dTmp, displayPath);
        fs.renameSync(tTmp, thumbPath);
        fetched += 1;
      }
      const meta = await sharp(displayPath).metadata();
      out.push({
        ...ph,
        file: `${base}.jpg`,
        sourceUrl: '',
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      });
    } catch (err) {
      console.error(`[strava] photo ${ph.id} failed:`, err);
    }
  }
  return { photos: out, fetched };
}

/** Best-effort start coordinate for enrichment, from the summary or the committed track. */
function startLatLng(summary: RawSummaryActivity | null, snap: AdventureActivity | null): [number, number] | null {
  const s = summary?.start_latlng;
  if (Array.isArray(s) && s.length === 2) return [s[0], s[1]];
  const first = snap?.track?.coordinates?.[0]; // [lng, lat]
  if (Array.isArray(first) && first.length === 2) return [first[1], first[0]];
  return null;
}

/**
 * Fill missing weather/location on an unchanged snapshot WITHOUT a Strava detail call. Returns the
 * updated snapshot only if it actually filled something (so a repeat run is a no-op — idempotent).
 */
async function retryEnrichment(
  snap: AdventureActivity,
  coords: [number, number],
): Promise<AdventureActivity | null> {
  const [lat, lng] = coords;
  let changed = false;
  const next: AdventureActivity = { ...snap, location: { ...snap.location } };

  if (!next.weather) {
    const weather = await fetchHistoricalWeather({
      lat,
      lng,
      date: (next.startLocal ?? '').slice(0, 10),
      startLocalIso: next.startLocal,
    });
    if (weather) {
      next.weather = weather;
      changed = true;
    }
    await sleep(PACING_MS);
  }
  if (!next.location.city && !next.location.state && !next.location.country) {
    const geo = await reverseGeocode(lat, lng);
    if (geo) {
      next.location = geo;
      changed = true;
    }
    await sleep(PACING_MS);
  }
  return changed ? next : null;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const creds = getCreds();
  const onlyIds = parseOnly();

  const companions = readCompanions((s) => matter(s));
  const neededIds = new Set<number>();
  const manualIds = new Set<number>(); // non-Strava (e.g. 14ers) — kept by GC, never fetched
  for (const c of companions) {
    c.ids.forEach((id) => neededIds.add(id));
    if (c.source) c.ids.forEach((id) => manualIds.add(id));
  }

  if (neededIds.size === 0 && !process.argv.includes('--prune-all')) {
    console.warn(
      '[strava] no activities referenced by content/adventures/*.md — refusing to prune the snapshot. Pass --prune-all to wipe it.',
    );
    return;
  }

  // Ids eligible for a Strava fetch: whitelisted and not manual. `--only` narrows to the requested.
  const fetchable = [...neededIds].filter((id) => !manualIds.has(id));
  const targetIds = onlyIds ? fetchable.filter((id) => onlyIds.has(id)) : fetchable;
  if (onlyIds) {
    const unknown = [...onlyIds].filter((id) => !neededIds.has(id));
    if (unknown.length) {
      console.warn(
        `[strava] --only: ${unknown.join(',')} not referenced by any companion — add content/adventures/*.md first (npm run adventure:new).`,
      );
    }
    if (targetIds.length === 0) {
      console.warn('[strava] --only: nothing to sync.');
      return;
    }
  }

  // Auth (persist rotation immediately).
  const token = await mintAccessToken(creds);
  if (token.rotated) {
    persistRefreshToken(token.refreshToken);
    console.warn(
      '[strava] ⚠ Refresh token rotated. New token written to .strava-token.json. ' +
        'Update STRAVA_REFRESH_TOKEN in your secret store (Vercel/Upstash) too — see docs/strava-stats.md.',
    );
  }
  const access = token.accessToken;

  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });

  // Summary crawl (once) drives change-detection AND the index rebuild. Skipped for `--only`, which
  // force-fetches its ids and refreshes the index incrementally.
  let rawAll: RawSummaryActivity[] | null = null;
  let summaries: Map<number, RawSummaryActivity> | null = null;
  if (!onlyIds) {
    rawAll = await pageRawSummaries(access, { retry: withBackoff });
    summaries = new Map(rawAll.map((a) => [a.id, a]));
    console.log(`[strava] summary crawl — ${rawAll.length} activities`);
  }

  // Decide which targets need a detail fetch. Unchanged ones cost zero Strava calls.
  const toFetch: number[] = [];
  let skipped = 0;
  let backfilled = 0;
  let enriched = 0;
  for (const id of targetIds) {
    const jsonPath = path.join(ACTIVITIES_DIR, `${id}.json`);
    const snap = readSnapshot(jsonPath);

    // Forced, targeted (`--only`), or brand-new → must detail-fetch.
    if (FORCE || onlyIds || !snap) {
      toFetch.push(id);
      continue;
    }

    const summary = summaries?.get(id) ?? null;
    // Not in the summary crawl (deleted / hidden / privacy) → keep the existing snapshot untouched.
    if (!summary) {
      skipped++;
      continue;
    }

    const sh = summaryHash(summary);
    if (snap.summaryHash !== undefined && snap.summaryHash !== sh) {
      toFetch.push(id); // genuine change on Strava
      continue;
    }

    // Unchanged (or pre-schema without a stored hash). Backfill summaryHash + workoutType from the
    // crawl — no detail call. (Assumes the snapshot is current from its last real sync; `--force` is
    // the backstop.)
    if (snap.summaryHash === undefined || snap.workoutType === undefined) {
      writeSnapshot(jsonPath, { ...snap, workoutType: summary.workout_type ?? null, summaryHash: sh });
      backfilled++;
      continue;
    }

    // Optionally heal a snapshot missing enrichment it should have — without a detail call.
    if (RETRY_ENRICHMENT && (!snap.weather || (!snap.location.city && !snap.location.state && !snap.location.country))) {
      const coords = startLatLng(summary, snap);
      if (coords) {
        const filled = await retryEnrichment(snap, coords);
        if (filled) {
          writeSnapshot(jsonPath, filled);
          enriched++;
          continue;
        }
      }
    }
    skipped++;
  }

  // Detail-fetch the changed/new/forced ids. Per-id failures are non-fatal: log, keep the existing
  // snapshot, and continue — one throttled id never aborts the whole run.
  let synced = 0;
  let photosDownloaded = 0;
  const failed: number[] = [];
  const missingGeo: number[] = [];
  const missingWeather: number[] = [];

  for (const id of toFetch) {
    const jsonPath = path.join(ACTIVITIES_DIR, `${id}.json`);
    try {
      const detail = await withBackoff(() => getActivityDetail(access, id), `detail ${id}`);
      await sleep(PACING_MS);
      if (!detail) {
        console.warn(`[strava] no detail for ${id} — keeping existing snapshot if present.`);
        continue;
      }

      // Static map thumbnail (basemap + route) for cards — generated once unless --force.
      const thumbPath = path.join(PUBLIC_DIR, String(id), 'route.jpg');
      if (detail.map?.summary_polyline && (FORCE || !fs.existsSync(thumbPath))) {
        const ok = await buildRouteThumb(decodePolyline(detail.map.summary_polyline), thumbPath);
        if (ok) console.log(`[strava] route thumb ${id}`);
      }

      const sHash = sourceHash(detail);
      const sumHash = summaryHash(detail); // detail is a RawSummaryActivity superset
      // Idempotency: a forced/only fetch of an unchanged activity shouldn't rewrite the snapshot.
      const prev = readSnapshot(jsonPath);
      if (!FORCE && prev && prev.sourceHash === sHash && prev.summaryHash === sumHash) {
        skipped++;
        continue;
      }

      const hasGeo =
        Boolean(detail.map?.summary_polyline) ||
        (Array.isArray(detail.start_latlng) && detail.start_latlng.length === 2);
      const streams = hasGeo
        ? await withBackoff(() => getActivityStreams(access, id), `streams ${id}`)
        : null;
      await sleep(PACING_MS);
      if (!detail.map?.summary_polyline && (!streams || !streams.latlng)) missingGeo.push(id);

      let weather: AdventureWeather | null = null;
      let weatherLat: number | null = null;
      let weatherLng: number | null = null;
      const sll = detail.start_latlng;
      if (Array.isArray(sll) && sll.length === 2) {
        [weatherLat, weatherLng] = sll as [number, number];
      } else if (detail.map?.summary_polyline) {
        const pts = decodePolyline(detail.map.summary_polyline);
        if (pts.length > 0) [weatherLat, weatherLng] = pts[0];
      }
      if (weatherLat != null && weatherLng != null) {
        weather = await fetchHistoricalWeather({
          lat: weatherLat,
          lng: weatherLng,
          date: (detail.start_date_local ?? '').slice(0, 10),
          startLocalIso: detail.start_date_local,
        });
        if (!weather) missingWeather.push(id);
        await sleep(PACING_MS);
      }

      // Photos are optional — never let a rate-limited photo fetch abort this activity.
      let rawPhotos: Awaited<ReturnType<typeof getActivityPhotos>> = [];
      try {
        rawPhotos = await withBackoff(() => getActivityPhotos(access, id), `photos ${id}`);
      } catch (err) {
        console.warn(`[strava] photos ${id} skipped:`, err instanceof Error ? err.message : err);
      }
      await sleep(PACING_MS);
      const built = buildPhotosFromRaw(rawPhotos);
      const { photos, fetched } = await downloadPhotos(built, path.join(PUBLIC_DIR, String(id)));
      photosDownloaded += fetched;

      const activity = transformDetailToActivity(detail, streams, weather, photos, {
        sourceHash: sHash,
        summaryHash: sumHash,
      });
      if (
        !activity.location.city &&
        !activity.location.state &&
        !activity.location.country &&
        weatherLat != null &&
        weatherLng != null
      ) {
        const geo = await reverseGeocode(weatherLat, weatherLng);
        if (geo) activity.location = geo;
        await sleep(PACING_MS);
      }
      writeSnapshot(jsonPath, activity);
      synced++;
      console.log(`[strava] synced ${id} — ${activity.name}`);
    } catch (err) {
      failed.push(id);
      console.error(`[strava] sync ${id} failed (keeping existing snapshot):`, err instanceof Error ? err.message : err);
    }
  }

  // GC orphans (activities no longer referenced) — full runs only; `--only` is surgical.
  let pruned = 0;
  if (!onlyIds) {
    if (fs.existsSync(ACTIVITIES_DIR)) {
      for (const f of fs.readdirSync(ACTIVITIES_DIR)) {
        if (!f.endsWith('.json')) continue;
        const id = Number(f.replace('.json', ''));
        if (!neededIds.has(id)) {
          fs.rmSync(path.join(ACTIVITIES_DIR, f));
          pruned++;
        }
      }
    }
    if (fs.existsSync(PUBLIC_DIR)) {
      for (const d of fs.readdirSync(PUBLIC_DIR)) {
        const id = Number(d);
        if (!Number.isNaN(id) && !neededIds.has(id)) {
          fs.rmSync(path.join(PUBLIC_DIR, d), { recursive: true, force: true });
        }
      }
    }
  }

  // Refresh the all-activity index and recompute lifetime + yearly totals. The full path reuses the
  // single summary crawl (rawAll); `--only` refreshes incrementally.
  const entries = await refreshIndex(access, {
    reindex: process.argv.includes('--reindex'),
    raw: rawAll ?? undefined,
  });
  writeTotals(entries);

  console.log(
    `[strava] done — synced ${synced}, skipped ${skipped}, backfilled ${backfilled}` +
      `${enriched ? `, enriched ${enriched}` : ''}, pruned ${pruned}, ~${photosDownloaded} photos. ` +
      `${missingGeo.length ? `no-geo: ${missingGeo.join(',')}. ` : ''}` +
      `${missingWeather.length ? `no-weather: ${missingWeather.join(',')}. ` : ''}` +
      `${failed.length ? `FAILED: ${failed.join(',')}.` : ''}`,
  );

  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
