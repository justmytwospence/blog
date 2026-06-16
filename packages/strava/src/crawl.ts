/**
 * Crawl the Strava summary endpoint into lightweight index entries — no per-activity detail.
 * Runtime-safe (no fs): used by the webhook route and the prod seed. Backoff is CAPPED (a couple of
 * short retries, never the full 15-minute rate-limit window) so it stays bounded inside a
 * serverless `after()` handler; if Strava throttles hard, it fails fast and the next event self-heals.
 */
import { listActivities, RateLimitError } from './client';
import { isPoolSwim } from './classify';
import type { RawSummaryActivity, AllActivityEntry } from './types';

const PER_PAGE = 200;
const PACING_MS = 300;
const MAX_RETRY_WAIT_MS = 5000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function toEntry(a: RawSummaryActivity): AllActivityEntry {
  const startLocal = a.start_date_local ?? '';
  return {
    id: a.id,
    date: startLocal.slice(0, 10),
    startEpoch: Math.floor(Date.parse(startLocal) / 1000) || 0,
    sport: a.sport_type ?? a.type ?? 'Workout',
    distanceMeters: Math.round(a.distance ?? 0),
    movingTimeSeconds: a.moving_time ?? 0,
    elevationGainMeters: Math.round(a.total_elevation_gain ?? 0),
    trainer: Boolean(a.trainer),
    commute: Boolean(a.commute),
    poolSwim: isPoolSwim(a),
    name: a.name ?? '',
    startLat: Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? a.start_latlng[0] : null,
    startLng: Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? a.start_latlng[1] : null,
  };
}

export async function crawlActivities(
  access: string,
  opts: { after?: number; maxPages?: number } = {},
): Promise<AllActivityEntry[]> {
  const maxPages = opts.maxPages ?? 100;
  const byId = new Map<number, AllActivityEntry>();

  for (let page = 1; page <= maxPages; page++) {
    let chunk: RawSummaryActivity[] | null = null;
    for (let attempt = 0; attempt < 3 && chunk === null; attempt++) {
      try {
        chunk = await listActivities(access, { page, perPage: PER_PAGE, after: opts.after });
      } catch (err) {
        if (err instanceof RateLimitError && attempt < 2) {
          await sleep(Math.min(err.retryAfterMs ?? 2000, MAX_RETRY_WAIT_MS));
        } else {
          throw err;
        }
      }
    }
    if (!chunk) break;
    for (const a of chunk) byId.set(a.id, toEntry(a));
    if (chunk.length < PER_PAGE) break;
    await sleep(PACING_MS);
  }

  return [...byId.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}
