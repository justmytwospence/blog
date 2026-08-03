/**
 * Page the Strava summary endpoint into activity entries — no per-activity detail. Runtime-safe
 * (no fs): used by the webhook route and the prod seed. The default retry policy is CAPPED (a couple
 * of short 429 backoffs, never the full 15-minute window) so it stays bounded inside a serverless
 * `after()` handler; if Strava throttles hard, it fails fast and the next event self-heals. The
 * author scripts inject a full-window backoff instead (see scripts/build-index.ts).
 */
import { listActivities, RateLimitError } from './client';
import { isPoolSwim } from './classify';
import type { RawSummaryActivity, AllActivityEntry } from './types';

const PER_PAGE = 200;
const PACING_MS = 300;
const MAX_RETRY_WAIT_MS = 5000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Wrap a single API call, retrying past Strava 429s. Lets callers swap the backoff policy without
 *  duplicating the paging loop (runtime = capped/bounded; scripts = full 15-min window). */
export type RetryPolicy = <T>(fn: () => Promise<T>, label: string) => Promise<T>;

const cappedRetry: RetryPolicy = async (fn, label) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RateLimitError && attempt < 2) {
        await sleep(Math.min(err.retryAfterMs ?? 2000, MAX_RETRY_WAIT_MS));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`[strava] crawl gave up on ${label}`);
};

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
    elevHighMeters: a.elev_high ?? null,
    totalPhotoCount: a.total_photo_count ?? 0,
  };
}

const byDateThenId = (a: AllActivityEntry, b: AllActivityEntry): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;

/**
 * Page the summary endpoint into RAW summaries, deduped by id. The single source of truth for both
 * the lightweight index (via `toEntry`) and the sync's change-detection (via `summaryHash`, which
 * needs summary_polyline / total_photo_count / workout_type that the trimmed index entry drops).
 */
export async function pageRawSummaries(
  access: string,
  opts: { after?: number; maxPages?: number; retry?: RetryPolicy } = {},
): Promise<RawSummaryActivity[]> {
  const maxPages = opts.maxPages ?? 100;
  const retry = opts.retry ?? cappedRetry;
  const byId = new Map<number, RawSummaryActivity>();
  for (let page = 1; page <= maxPages; page++) {
    const chunk = await retry(
      () => listActivities(access, { page, perPage: PER_PAGE, after: opts.after }),
      `list page ${page}`,
    );
    for (const a of chunk) byId.set(a.id, a);
    if (chunk.length < PER_PAGE) break;
    await sleep(PACING_MS);
  }
  return [...byId.values()];
}

/** Full crawl → sorted lightweight index entries. Used by the runtime totals recompute + seed. */
export async function crawlActivities(
  access: string,
  opts: { after?: number; maxPages?: number; retry?: RetryPolicy } = {},
): Promise<AllActivityEntry[]> {
  const raw = await pageRawSummaries(access, opts);
  return raw.map(toEntry).sort(byDateThenId);
}
