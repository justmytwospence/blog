/**
 * Query the local activity index for candidate adventures — the scripted alternative to the Strava
 * MCP, and the source of truth for discovery.
 *
 * Reads ONLY data/adventures/all-activities.json. No network, no credentials, no Strava calls, so it
 * works offline and on a machine that has never authenticated. The index is gitignored (it is
 * regenerable), so a fresh checkout must run `npm run sync:index` once — or pass `--refresh`.
 *
 *   npm run adventure:find -- --unpublished --after 2026-07-11
 *   npm run adventure:find -- --sport TrailRun --min-gain 2000 --min-high 12000
 *   npm run adventure:find -- --unpublished --with-photos --json
 *
 * Filters (thresholds are imperial, matching the site's default display):
 *   --after / --before <YYYY-MM-DD>  inclusive date bounds
 *   --sport <a,b>                    raw Strava sport_type or mapped SportType, case-insensitive
 *   --min-distance <mi>              minimum distance
 *   --min-gain <ft>                  minimum elevation gain
 *   --min-high <ft>                  minimum summit elevation
 *   --with-photos                    only activities with photos on Strava
 *   --unpublished                    exclude ids already referenced by a companion .md
 *   --limit <n>                      cap the output (default 30); --all for no cap
 *   --json                           raw AllActivityEntry[] in SI units
 *   --refresh                        re-crawl the index first (needs .env.local)
 */
import fs from 'node:fs';
import { mapSportType, type AllActivityEntry } from '@blog/strava';
import {
  ALL_ACTIVITIES_FILE,
  loadEnvLocal,
  getCreds,
  persistRefreshToken,
  readCompanions,
} from './strava-shared';
import { M_PER_MI, FT_PER_M } from '../lib/units';

/** Days after which the index is old enough to warn about. */
const STALE_DAYS = 7;
const DEFAULT_LIMIT = 30;

export interface FindFilters {
  after?: string;
  before?: string;
  sports?: string[];
  minDistanceMeters?: number;
  minGainMeters?: number;
  minElevHighMeters?: number;
  withPhotos?: boolean;
  unpublishedOnly?: boolean;
  limit?: number;
}

/**
 * Pure filter over index entries, newest first. `publishedIds` is injected rather than read from
 * disk so this is testable without a content tree.
 *
 * Entries written before the index carried elevHighMeters/totalPhotoCount are tolerated: a missing
 * summit elevation simply fails --min-high rather than throwing.
 */
export function filterActivities(
  entries: AllActivityEntry[],
  filters: FindFilters,
  publishedIds: ReadonlySet<number> = new Set(),
): AllActivityEntry[] {
  const sports = filters.sports?.map((s) => s.toLowerCase());
  const out = entries.filter((e) => {
    if (filters.after && e.date < filters.after) return false;
    if (filters.before && e.date > filters.before) return false;
    if (filters.unpublishedOnly && publishedIds.has(e.id)) return false;
    if (sports?.length) {
      const raw = (e.sport ?? '').toLowerCase();
      const mapped = mapSportType(e.sport).toLowerCase();
      if (!sports.includes(raw) && !sports.includes(mapped)) return false;
    }
    if (filters.minDistanceMeters != null && (e.distanceMeters ?? 0) < filters.minDistanceMeters) return false;
    if (filters.minGainMeters != null && (e.elevationGainMeters ?? 0) < filters.minGainMeters) return false;
    if (filters.minElevHighMeters != null && (e.elevHighMeters ?? 0) < filters.minElevHighMeters) return false;
    if (filters.withPhotos && (e.totalPhotoCount ?? 0) <= 0) return false;
    return true;
  });
  // Newest first; id breaks ties so the ordering is stable across runs.
  out.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  return filters.limit != null ? out.slice(0, filters.limit) : out;
}

/** Fixed-width table, newest first. */
export function formatTable(rows: AllActivityEntry[]): string {
  const head = ['ID', 'DATE', 'SPORT', 'DIST', 'GAIN', 'HIGH', 'PH', 'NAME'];
  const body = rows.map((e) => [
    String(e.id),
    e.date,
    e.sport ?? '',
    `${((e.distanceMeters ?? 0) / M_PER_MI).toFixed(1)} mi`,
    `${Math.round((e.elevationGainMeters ?? 0) * FT_PER_M)} ft`,
    e.elevHighMeters != null ? `${Math.round(e.elevHighMeters * FT_PER_M)} ft` : '—',
    String(e.totalPhotoCount ?? 0),
    e.name ?? '',
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ').trimEnd();
  return [line(head), ...body.map(line)].join('\n');
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function value(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function num(name: string): number | undefined {
  const raw = value(name);
  if (raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.error(`[adventure:find] --${name} expects a number, got "${raw}"`);
    process.exit(1);
  }
  return n;
}

function date(name: string): string | undefined {
  const raw = value(name);
  if (raw == null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    console.error(`[adventure:find] --${name} expects YYYY-MM-DD, got "${raw}"`);
    process.exit(1);
  }
  return raw;
}

async function main(): Promise<void> {
  if (flag('refresh')) {
    // Explicit opt-in only: discovery is otherwise offline and must not surprise-mutate the index.
    const { mintAccessToken } = await import('@blog/strava');
    const { refreshIndex } = await import('./build-index');
    loadEnvLocal();
    const token = await mintAccessToken(getCreds());
    if (token.rotated) persistRefreshToken(token.refreshToken);
    await refreshIndex(token.accessToken, { reindex: true });
  }

  if (!fs.existsSync(ALL_ACTIVITIES_FILE)) {
    console.error(
      '[adventure:find] no activity index at data/adventures/all-activities.json\n' +
        '  It is gitignored (regenerable), so a fresh checkout has none. Build it with:\n' +
        '    npm run sync:index\n' +
        '  or re-run this command with --refresh.',
    );
    process.exit(1);
  }

  const entries: AllActivityEntry[] = JSON.parse(fs.readFileSync(ALL_ACTIVITIES_FILE, 'utf8'));
  const unpublishedOnly = flag('unpublished');
  const publishedIds = unpublishedOnly
    ? new Set(readCompanions().flatMap((c) => c.ids))
    : new Set<number>();

  const minDistanceMi = num('min-distance');
  const minGainFt = num('min-gain');
  const minHighFt = num('min-high');
  const limit = flag('all') ? undefined : (num('limit') ?? DEFAULT_LIMIT);

  const rows = filterActivities(
    entries,
    {
      after: date('after'),
      before: date('before'),
      sports: value('sport')?.split(',').map((s) => s.trim()).filter(Boolean),
      minDistanceMeters: minDistanceMi != null ? minDistanceMi * M_PER_MI : undefined,
      minGainMeters: minGainFt != null ? minGainFt / FT_PER_M : undefined,
      minElevHighMeters: minHighFt != null ? minHighFt / FT_PER_M : undefined,
      withPhotos: flag('with-photos'),
      unpublishedOnly,
      limit,
    },
    publishedIds,
  );

  if (flag('json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const newest = entries.reduce((max, e) => (e.date > max ? e.date : max), '');
  const ageDays = Math.floor((Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000);
  const missingElev = entries.filter((e) => e.elevHighMeters === undefined).length;

  console.log(rows.length ? formatTable(rows) : '(no activities matched)');
  console.log(
    `\n${rows.length} of ${entries.length} activities` +
      (unpublishedOnly ? ' · unpublished only' : '') +
      ` · index through ${newest}`,
  );
  if (ageDays > STALE_DAYS) {
    console.log(`⚠ index is ${ageDays} days old — refresh with: npm run sync:index`);
  }
  if (missingElev > 0) {
    console.log(`⚠ ${missingElev} entries predate the summit-elevation field — npm run sync:index -- --reindex`);
  }
  if (rows.length) {
    console.log('\nNext:  npm run adventure:new -- <id> --type peak --difficulty moderate --tags <a,b>');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
