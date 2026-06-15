/**
 * Maintain the committed lightweight index of ALL Strava activities
 * (data/adventures/all-activities.json), built from the summary endpoint only — no per-activity
 * detail calls. Incremental by default (fetch only activities newer than the latest indexed);
 * `--reindex` re-pages the full history. The index is the deterministic source for lifetime totals.
 *
 *   npx tsx scripts/build-index.ts [--reindex]
 */
import fs from 'node:fs';
import {
  mintAccessToken,
  listActivities,
  isPoolSwim,
  type RawSummaryActivity,
  type AllActivityEntry,
} from '@blog/strava';
import {
  ALL_ACTIVITIES_FILE,
  getCreds,
  loadEnvLocal,
  persistRefreshToken,
  sleep,
  withBackoff,
} from './strava-shared';

const PER_PAGE = 200;
const PACING_MS = 300;

function toEntry(a: RawSummaryActivity): AllActivityEntry {
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

function readIndex(): AllActivityEntry[] {
  if (!fs.existsSync(ALL_ACTIVITIES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ALL_ACTIVITIES_FILE, 'utf8')) as AllActivityEntry[];
  } catch {
    return [];
  }
}

const byDateThenId = (a: AllActivityEntry, b: AllActivityEntry): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;

/**
 * Refresh the all-activity index. Pages the summary endpoint, merging by id (so an incremental run
 * that overlaps the boundary is harmless). Writes a stable, sorted JSON — same input → same output.
 */
export async function refreshIndex(access: string, opts: { reindex?: boolean } = {}): Promise<AllActivityEntry[]> {
  const existing = opts.reindex ? [] : readIndex();
  const byId = new Map<number, AllActivityEntry>(existing.map((e) => [e.id, e]));
  // Incremental: fetch only what's newer than the latest indexed (minus a day's margin to catch
  // same-day stragglers and the local/UTC offset; the id-merge dedupes the overlap).
  const after =
    !opts.reindex && existing.length ? Math.max(...existing.map((e) => e.startEpoch)) - 86_400 : undefined;
  let fetched = 0;
  for (let page = 1; page <= 100; page++) {
    const chunk = await withBackoff(
      () => listActivities(access, { page, perPage: PER_PAGE, after }),
      `list page ${page}`,
    );
    for (const a of chunk) byId.set(a.id, toEntry(a));
    fetched += chunk.length;
    if (chunk.length < PER_PAGE) break;
    await sleep(PACING_MS);
  }
  const entries = [...byId.values()].sort(byDateThenId);
  fs.writeFileSync(ALL_ACTIVITIES_FILE, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`[index] ${opts.reindex ? 'reindexed' : 'refreshed'} — ${fetched} fetched, ${entries.length} total`);
  return entries;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const token = await mintAccessToken(getCreds());
  if (token.rotated) persistRefreshToken(token.refreshToken);
  await refreshIndex(token.accessToken, { reindex: process.argv.includes('--reindex') });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
