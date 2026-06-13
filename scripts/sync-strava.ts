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
  RateLimitError,
  type RawDetailedActivity,
  type AdventurePhoto,
  type AdventureWeather,
} from '@blog/strava';
import {
  ACTIVITIES_DIR,
  CACHE_FILE,
  DATA_DIR,
  INDEX_FILE,
  PUBLIC_DIR,
  getCreds,
  loadEnvLocal,
  persistRefreshToken,
  readCompanions,
  sleep,
} from './strava-shared';

const SCHEMA_VERSION = 1;
const PACING_MS = 300;
const FORCE = process.argv.includes('--force');

interface CacheEntry {
  sourceHash: string;
  syncedAt: string;
}
type Cache = Record<string, CacheEntry>;

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

async function withBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.warn(`[strava] 429 on ${label}; backing off ${delay}ms`);
        await sleep(delay);
        delay = Math.min(delay * 2, 60000);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`[strava] gave up after rate-limit retries on ${label}`);
}

async function downloadPhotos(photos: AdventurePhoto[], dir: string): Promise<AdventurePhoto[]> {
  if (photos.length === 0) return [];
  fs.mkdirSync(dir, { recursive: true });
  const out: AdventurePhoto[] = [];
  for (const ph of photos) {
    const safe = ph.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const base = `photo-${safe}`;
    const displayPath = path.join(dir, `${base}.jpg`);
    const thumbPath = path.join(dir, `${base}-thumb.jpg`);
    try {
      if (!fs.existsSync(displayPath) || !fs.existsSync(thumbPath)) {
        const res = await fetch(ph.sourceUrl);
        if (!res.ok) {
          console.error(`[strava] photo ${ph.id} download ${res.status}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toFile(displayPath);
        await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 72, progressive: true }).toFile(thumbPath);
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
  return out;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const creds = getCreds();

  const companions = readCompanions((s) => matter(s));
  const neededIds = new Set<number>();
  for (const c of companions) c.ids.forEach((id) => neededIds.add(id));

  if (neededIds.size === 0) {
    console.log('[strava] no activities referenced by content/adventures/*.md — nothing to sync.');
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
  const cache: Cache = fs.existsSync(CACHE_FILE)
    ? (JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Cache)
    : {};

  let synced = 0;
  let skipped = 0;
  let photosDownloaded = 0;
  const missingGeo: number[] = [];
  const missingWeather: number[] = [];

  for (const id of neededIds) {
    const jsonPath = path.join(ACTIVITIES_DIR, `${id}.json`);
    const detail = await withBackoff(() => getActivityDetail(access, id), `detail ${id}`);
    await sleep(PACING_MS);
    if (!detail) {
      console.warn(`[strava] no detail for ${id} — keeping existing snapshot if present.`);
      continue;
    }

    const hash = sourceHash(detail);
    if (!FORCE && cache[String(id)]?.sourceHash === hash && fs.existsSync(jsonPath)) {
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
    const startLatLng = detail.start_latlng;
    if (Array.isArray(startLatLng) && startLatLng.length === 2) {
      const [lat, lng] = startLatLng as [number, number];
      weather = await fetchHistoricalWeather({
        lat,
        lng,
        date: (detail.start_date_local ?? '').slice(0, 10),
        startLocalIso: detail.start_date_local,
      });
      if (!weather) missingWeather.push(id);
      await sleep(PACING_MS);
    }

    const rawPhotos = await withBackoff(() => getActivityPhotos(access, id), `photos ${id}`);
    await sleep(PACING_MS);
    const built = buildPhotosFromRaw(rawPhotos);
    const before = countFiles(path.join(PUBLIC_DIR, String(id)));
    const photos = await downloadPhotos(built, path.join(PUBLIC_DIR, String(id)));
    photosDownloaded += Math.max(0, countFiles(path.join(PUBLIC_DIR, String(id))) - before) / 2;

    const activity = transformDetailToActivity(detail, streams, weather, photos, {
      syncedAt: new Date().toISOString(),
      sourceHash: hash,
    });
    fs.writeFileSync(jsonPath, JSON.stringify(activity, null, 2));
    cache[String(id)] = { sourceHash: hash, syncedAt: activity.syncedAt };
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
        delete cache[String(id)];
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

  // Rebuild the lightweight index.
  const indexActivities = fs
    .readdirSync(ACTIVITIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const a = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, f), 'utf8'));
      return {
        stravaId: a.stravaId,
        date: a.date,
        sportType: a.sportType,
        name: a.name,
        hasTrack: Boolean(a.track) && a.track.coordinates.length > 1,
        photoCount: a.photos.length,
      };
    });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), activities: indexActivities }, null, 2),
  );
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  console.log(
    `[strava] done — synced ${synced}, skipped ${skipped} (unchanged), pruned ${pruned}, ` +
      `~${Math.round(photosDownloaded)} photos downloaded. ` +
      `${missingGeo.length ? `no-geo: ${missingGeo.join(',')}. ` : ''}` +
      `${missingWeather.length ? `no-weather: ${missingWeather.join(',')}.` : ''}`,
  );
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).length;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
