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
  pageRawSummaries,
  toEntry,
  type RawSummaryActivity,
  type AllActivityEntry,
} from '@blog/strava';
import {
  ALL_ACTIVITIES_FILE,
  getCreds,
  loadEnvLocal,
  persistRefreshToken,
  withBackoff,
} from './strava-shared';

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
 * Refresh the all-activity index and write a stable, sorted JSON. Modes:
 *  - default: incremental — page only what's newer than the latest indexed, merge by id.
 *  - `reindex`: re-page the full history from scratch.
 *  - `raw`: build from a pre-fetched full crawl (the sync already paged the summaries once — reuse
 *    them instead of a second network crawl). Treated as authoritative/full (no merge with the old
 *    index, so Strava-side deletes drop out).
 * The author scripts page with the full 15-min `withBackoff`.
 */
export async function refreshIndex(
  access: string,
  opts: { reindex?: boolean; raw?: RawSummaryActivity[] } = {},
): Promise<AllActivityEntry[]> {
  const full = opts.reindex || opts.raw !== undefined;
  const existing = full ? [] : readIndex();
  const byId = new Map<number, AllActivityEntry>(existing.map((e) => [e.id, e]));
  let raw = opts.raw;
  if (!raw) {
    // Incremental: fetch only what's newer than the latest indexed (minus a day's margin to catch
    // same-day stragglers and the local/UTC offset; the id-merge dedupes the overlap).
    const after = existing.length ? Math.max(...existing.map((e) => e.startEpoch)) - 86_400 : undefined;
    raw = await pageRawSummaries(access, { after, retry: withBackoff });
  }
  for (const a of raw) byId.set(a.id, toEntry(a));
  const entries = [...byId.values()].sort(byDateThenId);
  fs.writeFileSync(ALL_ACTIVITIES_FILE, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`[index] ${full ? 'rebuilt' : 'refreshed'} — ${raw.length} fetched, ${entries.length} total`);
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
