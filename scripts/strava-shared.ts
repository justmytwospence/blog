/**
 * Shared helpers for the Strava author-time scripts (sync / inbox / bootstrap).
 * Resolves paths from the script's own location so it works regardless of cwd.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parseStravaIds, RateLimitError, type RawSummaryActivity } from '@blog/strava';
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
 * Tradeoff: a description-only edit doesn't move this hash (reconcile with `--force`/`--only`).
 */
const SUMMARY_HASH_VERSION = 1;
export function summaryHash(a: RawSummaryActivity): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        v: SUMMARY_HASH_VERSION,
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
      }),
    )
    .digest('hex');
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
