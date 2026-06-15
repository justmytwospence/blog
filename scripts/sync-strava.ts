/**
 * Sync the whitelisted Strava activities into the committed repo snapshot.
 *
 *   - Whitelist = the Strava ids referenced by content/adventures/*.md companion files.
 *   - For each id: fetch detail (+ streams + photos + weather), download/resize photos,
 *     write data/adventures/activities/<id>.json. Skip-unchanged via sourceHash cache.
 *   - GC orphaned activities/photos, rebuild index.json. Persist a rotated refresh token.
 *
 * Run: npm run sync:strava   (reads .env.local). Fails loudly on bad creds.
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
  type RawDetailedActivity,
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
  withBackoff,
} from './strava-shared';
import { buildRouteThumb } from './route-thumb';
import { refreshIndex } from './build-index';
import { writeTotals } from './build-totals';

const SCHEMA_VERSION = 1;
const PACING_MS = 300;
const FORCE = process.argv.includes('--force');

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

async function main(): Promise<void> {
  loadEnvLocal();
  const creds = getCreds();

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

  // Auth (persist rotation immediately).
  const token = await mintAccessToken(creds);
  if (token.rotated) {
    persistRefreshToken(token.refreshToken);
    console.warn(
      '[strava] ⚠ Refresh token rotated. New token written to .strava-token.json. ' +
        'Update STRAVA_REFRESH_TOKEN in your secret store (Vercel/CI) too.',
    );
  }
  const access = token.accessToken;

  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });

  let synced = 0;
  let skipped = 0;
  let photosDownloaded = 0;
  const missingGeo: number[] = [];
  const missingWeather: number[] = [];

  for (const id of neededIds) {
    if (manualIds.has(id)) continue; // non-Strava import; keep its committed snapshot, don't fetch
    const jsonPath = path.join(ACTIVITIES_DIR, `${id}.json`);
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

    const hash = sourceHash(detail);
    // Skip-unchanged by comparing against the committed snapshot's own hash — no separate cache file.
    if (!FORCE && fs.existsSync(jsonPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as { sourceHash?: string };
        if (prev.sourceHash === hash) {
          skipped++;
          continue;
        }
      } catch {
        /* unreadable snapshot — fall through and resync */
      }
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
    const startLatLng = detail.start_latlng;
    if (Array.isArray(startLatLng) && startLatLng.length === 2) {
      [weatherLat, weatherLng] = startLatLng as [number, number];
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

    // Photos are optional — never let a rate-limited photo fetch abort the whole sync.
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
      sourceHash: hash,
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
    fs.writeFileSync(jsonPath, JSON.stringify(activity, null, 2));
    synced++;
    console.log(`[strava] synced ${id} — ${activity.name}`);
  }

  // GC orphans (activities no longer referenced).
  let pruned = 0;
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

  // Refresh the committed all-activity index (incremental summary paging) and recompute the
  // lifetime + yearly totals from it — the deterministic, idempotent stats pipeline.
  const entries = await refreshIndex(access, { reindex: process.argv.includes('--reindex') });
  writeTotals(entries);

  console.log(
    `[strava] done — synced ${synced}, skipped ${skipped} (unchanged), pruned ${pruned}, ` +
      `~${Math.round(photosDownloaded)} photos downloaded. ` +
      `${missingGeo.length ? `no-geo: ${missingGeo.join(',')}. ` : ''}` +
      `${missingWeather.length ? `no-weather: ${missingWeather.join(',')}.` : ''}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
