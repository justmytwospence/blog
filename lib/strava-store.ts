/**
 * Runtime store for the rolling adventure stats — totals + Strava auth in Upstash Redis.
 *
 * The stats no longer live in git. The webhook computes totals and writes them here; pages read
 * `strava:totals` (a single fast lookup, never hitting Strava at render). The Strava refresh token
 * lives in `strava:auth` so a rotation persists across invocations (which a Vercel env var can't).
 *
 * The client is LAZY and ENV-GATED: with no Redis env (CI build, a fresh clone) nothing is
 * constructed and the readers return null, so `next build` / local dev fall back gracefully.
 */
import { cache } from 'react';
import { buildTotals, crawlActivities, mintAccessToken, type StravaTotals } from '@blog/strava';
import { revalidatePath } from 'next/cache';
import { getRedis, hasStore } from './redis';
import { readThrough } from './last-good';

const TOTALS_KEY = 'strava:totals';
const AUTH_KEY = 'strava:auth';

interface StoredAuth {
  refreshToken: string;
  accessToken: string;
  expiresAt: number; // unix seconds
}

export { hasStore };

/**
 * Throwing read of the totals key, for readThrough. A missing key throws deliberately: an unseeded
 * or evicted `strava:totals` is exactly the case a stored last-good value should cover, and
 * returning null here would let readThrough treat the emptiness as success and overwrite it.
 */
async function fetchTotalsOrThrow(): Promise<StravaTotals> {
  const redis = getRedis();
  if (!redis) throw new Error('[strava-store] no Redis store configured');
  const totals = await redis.get<StravaTotals>(TOTALS_KEY);
  if (!totals) throw new Error(`[strava-store] ${TOTALS_KEY} is empty (run npm run seed:redis)`);
  return totals;
}

/**
 * Totals for render, behind the last-good read-through so an emptied or failed store read serves the
 * last good copy instead of zeroing the page. Deduped per render via React cache, so one pass costs
 * one read and at most one last-good write however many callers ask.
 *
 * Coverage caveat: unlike the other integrations — where the fetcher hits an external API and Redis
 * is an independent safety net — the source here IS Redis, and last-good lives in the same instance.
 * This covers an evicted/corrupt `strava:totals`, a transient failure, or a bad write from a partly
 * failed recomputeTotals. It does NOT survive a full Upstash outage; the page-level guard on empty
 * totals is what covers that.
 *
 * Null with no Redis env (dev/CI) — the caller falls back to the gitignored local totals file.
 */
export const readTotals = cache(async (): Promise<StravaTotals | null> => {
  if (!hasStore()) return null;
  return readThrough<StravaTotals>(TOTALS_KEY, fetchTotalsOrThrow);
});

/** Persist freshly computed totals (called by the webhook). No-op without a store. */
export async function writeTotals(totals: StravaTotals): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn('[strava-store] no Redis env — writeTotals skipped');
    return;
  }
  await redis.set(TOTALS_KEY, totals);
}

/**
 * A valid Strava access token. Prefers the rotated refresh token persisted in `strava:auth` over the
 * env seed (matches the script's getCreds precedence — reversing it would clobber a rotated token and
 * cause silent auth death). Persists any rotation BEFORE returning.
 */
export async function getAccessToken(): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const envRefresh = process.env.STRAVA_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !envRefresh) {
    throw new Error('[strava-store] missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN');
  }

  const redis = getRedis();
  if (!redis) {
    // No store: mint from env (can't persist a rotation, but keeps a store-less env working).
    const t = await mintAccessToken({ clientId, clientSecret, refreshToken: envRefresh });
    return t.accessToken;
  }

  const stored = (await redis.get<StoredAuth>(AUTH_KEY)) ?? null;
  if (stored && stored.expiresAt - Date.now() / 1000 > 300) return stored.accessToken;

  const refreshToken = stored?.refreshToken ?? envRefresh;
  const t = await mintAccessToken({ clientId, clientSecret, refreshToken });
  await redis.set(AUTH_KEY, {
    refreshToken: t.refreshToken,
    accessToken: t.accessToken,
    expiresAt: t.expiresAt,
  });
  return t.accessToken;
}

/**
 * Recompute the rolling totals from a full Strava crawl, persist them, and revalidate /adventures.
 * Shared by the webhook (`after()` an activity event) and the daily reconcile cron (a safety net for
 * a webhook event that Strava dropped after its retries). The crawl is a full re-page, so any single
 * successful run fully rebuilds the totals regardless of which events were missed.
 */
export async function recomputeTotals(): Promise<void> {
  const access = await getAccessToken();
  const entries = await crawlActivities(access);
  const totals = buildTotals(entries);
  await writeTotals(totals);
  revalidatePath('/adventures');
}
