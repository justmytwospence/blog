/**
 * Shared helpers for the Strava author-time scripts (sync / inbox / bootstrap).
 * Resolves paths from the script's own location so it works regardless of cwd.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStravaIds } from '@blog/strava';

export const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONTENT_DIR = path.join(REPO_ROOT, 'content', 'adventures');
export const DATA_DIR = path.join(REPO_ROOT, 'data', 'adventures');
export const ACTIVITIES_DIR = path.join(DATA_DIR, 'activities');
export const INDEX_FILE = path.join(DATA_DIR, 'index.json');
export const CACHE_FILE = path.join(DATA_DIR, '.sync-cache.json');
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
}

/** Read all report companion files and the Strava ids they reference. */
export function readCompanions(matterFn: (s: string) => { data: Record<string, unknown> }): Companion[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const out: Companion[] = [];
  for (const f of fs.readdirSync(CONTENT_DIR)) {
    if (!f.endsWith('.md') || f === 'objectives.md' || f.startsWith('.')) continue;
    try {
      const fm = matterFn(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')).data;
      out.push({
        file: f,
        slug: f.replace(/\.md$/, ''),
        ids: parseStravaIds(fm),
        hidden: Boolean(fm.hidden),
        source: fm.source ? String(fm.source) : null,
      });
    } catch (err) {
      console.error(`[strava] could not parse ${f}:`, err);
    }
  }
  return out;
}
