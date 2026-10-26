/**
 * Shared helpers for the Strava author-time scripts (sync / inbox / bootstrap).
 * Resolves paths from the script's own location so it works regardless of cwd.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  parseStravaIds,
  RateLimitError,
  type RawDetailedActivity,
  type RawPhoto,
  type RawSummaryActivity,
} from '@blog/strava';
import { isCompanionFile } from '../lib/adventure-schema';

export const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONTENT_DIR = path.join(REPO_ROOT, 'content', 'adventures');
export const DATA_DIR = path.join(REPO_ROOT, 'data', 'adventures');
export const ACTIVITIES_DIR = path.join(DATA_DIR, 'activities');
export const ALL_ACTIVITIES_FILE = path.join(DATA_DIR, 'all-activities.json');
export const LIFETIME_FILE = path.join(DATA_DIR, 'lifetime-totals.json');
export const YEARLY_FILE = path.join(DATA_DIR, 'yearly-totals.json');
export const PUBLIC_DIR = path.join(REPO_ROOT, 'public', 'adventures');
export const TOKEN_FILE = path.join(REPO_ROOT, '.strava-token.json');

/** Minimal .env.local loader (does not overwrite already-set env vars). */
export function loadEnvLocal(): void {
  const p = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export interface StravaCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Read creds from env, preferring a rotated refresh token persisted in .strava-token.json. */
export function getCreds(): StravaCreds {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  let refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const j = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as { refreshToken?: string };
      if (j.refreshToken) refreshToken = j.refreshToken;
    } catch {
      /* ignore malformed token file */
    }
  }
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      '[strava] missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN (set them in .env.local)',
    );
  }
  return { clientId, clientSecret, refreshToken };
}

/** Persist a rotated refresh token to the gitignored token file. */
export function persistRefreshToken(refreshToken: string): void {
  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify({ refreshToken, rotatedAt: new Date().toISOString() }, null, 2),
  );
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Retry an API call through Strava 429s, backing off up to a full 15-minute rate-limit window. */
export async function withBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; attempt < 14; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RateLimitError) {
        const wait = err.retryAfterMs ?? delay;
        console.warn(`[strava] 429 on ${label}; backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1})`);
        await sleep(wait);
        delay = Math.min(delay * 2, 120000);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`[strava] gave up after rate-limit retries on ${label}`);
}

/**
 * Deterministic fingerprint of the change-detecting fields that Strava returns on the SUMMARY
 * endpoint — everything the detail-level `sourceHash` uses EXCEPT `description` (detail-only), plus
 * `workout_type`. The sync stores this on each snapshot and recomputes it from one cheap summary
 * crawl, so it can decide which whitelisted activities actually changed WITHOUT a per-id detail call.
 * Tradeoff: description and photo swaps/captions aren't on the summary endpoint, so they don't move
 * this hash — the sync's recent-window recheck (and `--only` / `--force`) catches those via `sourceHash`.
 *
 * v2 added `gear_id`. A snapshot still carrying a v1 hash is migrated in place (see `summaryHashV1`).
 */
export function summaryHash(a: RawSummaryActivity): string {
  return hashSummary(a, 2);
}

/**
 * The pre-`gear_id` fingerprint. Only used to migrate snapshots: a stored hash equal to this means
 * nothing summary-level changed under the old scheme, so the sync rewrites the v2 hash without a
 * detail fetch (rather than re-fetching every activity once just because the hash grew a field).
 */
export function summaryHashV1(a: RawSummaryActivity): string {
  return hashSummary(a, 1);
}

function hashSummary(a: RawSummaryActivity, v: 1 | 2): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        v,
        id: a.id,
        name: a.name,
        distance: a.distance,
        moving_time: a.moving_time,
        gain: a.total_elevation_gain,
        start: a.start_date_local,
        poly: a.map?.summary_polyline ?? null,
        photos: a.total_photo_count ?? null,
        sport: a.sport_type ?? a.type,
        workout: a.workout_type ?? null,
        ...(v >= 2 ? { gear: a.gear_id ?? null } : {}),
      }),
    )
    .digest('hex');
}

/**
 * Detail-level fingerprint — decides whether a fetched activity's snapshot needs rewriting. Covers
 * everything in `summaryHash` plus what only the detail + photos endpoints expose: `description`,
 * gear, and each photo's identity and caption (so a same-count photo swap or a caption edit counts).
 */
export function sourceHash(detail: RawDetailedActivity, photos: RawPhoto[]): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        v: 2,
        id: detail.id,
        name: detail.name,
        distance: detail.distance,
        moving_time: detail.moving_time,
        gain: detail.total_elevation_gain,
        start: detail.start_date ?? detail.start_date_local,
        poly: detail.map?.summary_polyline ?? null,
        photos: photos.map((p) => [p.unique_id, p.caption ?? null]),
        sport: detail.sport_type ?? detail.type,
        workout: detail.workout_type ?? null,
        gear: detail.gear_id ?? null,
        desc: detail.description ?? null,
      }),
    )
    .digest('hex');
}

/** Photo files an activity's directory should keep: Strava photos + hand imports, each with its thumb. */
export function keptPhotoFiles(photos: { file: string }[]): Set<string> {
  return new Set(photos.flatMap((p) => [p.file, p.file.replace(/\.jpg$/, '-thumb.jpg')]));
}

/** `photo-*` files in `files` that no current photo references (route.jpg etc. are never touched). */
export function stalePhotoFiles(files: string[], keep: Set<string>): string[] {
  return files.filter((f) => f.startsWith('photo-') && !f.endsWith('.tmp') && !keep.has(f));
}

/** Hand-imported photos (Google Takeout backfill) — merged on read by lib/adventures.ts. */
export const LOCAL_PHOTOS_DIR = path.join(DATA_DIR, 'local-photos');
export function readLocalPhotos(id: number): { file: string }[] {
  const p = path.join(LOCAL_PHOTOS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf8')); // throw: never GC on a bad sidecar
  return Array.isArray(parsed) ? (parsed as { file: string }[]) : [];
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'activity'
  );
}

export interface Companion {
  file: string;
  slug: string;
  ids: number[];
  hidden: boolean;
  source: string | null; // non-Strava origin (e.g. "14ers") — sync keeps but doesn't fetch these
  group: string | null; // shared key across repeat trips of the same route
  laps: boolean; // a same-peak/route lap outing — counts ascents, not peaks
}

/** Every companion filename in `dir`, sorted. The fs half of `isCompanionFile`. */
export function listCompanionFiles(dir: string = CONTENT_DIR): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(isCompanionFile).sort() : [];
}

/**
 * Read all report companion files and the Strava ids they reference.
 *
 * `matterFn` stays injectable (existing callers pass their own gray-matter binding) but defaults, so
 * new call sites can just call `readCompanions()`. `dir` is a seam for fixture tests.
 * A malformed companion is logged and skipped rather than aborting the whole read.
 */
export function readCompanions(
  matterFn: (s: string) => { data: Record<string, unknown> } = matter,
  dir: string = CONTENT_DIR,
): Companion[] {
  const out: Companion[] = [];
  for (const f of listCompanionFiles(dir)) {
    try {
      const fm = matterFn(fs.readFileSync(path.join(dir, f), 'utf8')).data;
      out.push({
        file: f,
        slug: f.replace(/\.md$/, ''),
        ids: parseStravaIds(fm),
        hidden: Boolean(fm.hidden),
        source: fm.source ? String(fm.source) : null,
        group: fm.group ? String(fm.group) : null,
        laps: Boolean(fm.laps),
      });
    } catch (err) {
      console.error(`[strava] could not parse ${f}:`, err);
    }
  }
  return out;
}
