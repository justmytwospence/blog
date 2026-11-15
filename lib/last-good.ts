/**
 * Last-good read-through cache backed by Upstash Redis.
 *
 * Wraps a data fetcher so a public page never blanks when an upstream API is down: on success the
 * payload is persisted under `last-good:<key>` and returned; on a fetcher throw the last persisted
 * payload is served instead (or null when none was ever stored).
 *
 * With no Redis env (CI build, local dev without creds) it is a pure pass-through: it calls the
 * fetcher and lets a failure propagate, so the caller keeps whatever non-Redis fallback it already
 * has. Failure MUST be signalled by the fetcher THROWING — a returned `[]` is treated as success,
 * so a legitimately empty list is cached as good rather than mistaken for an outage.
 *
 * Freshness is governed by the caller's ISR window (which re-runs the fetcher and overwrites the
 * stored value). There is no TTL by default: the safety net must outlive an arbitrarily long
 * outage. ISR is the cache; this is the fallback.
 */
import { getRedis } from './redis';
import { isPreviewDeployment, previewCachePrefix } from './deployment';

export interface ReadThroughOptions {
  /** Optional expiry in seconds. Omit for a last-good value that should outlive any outage. */
  ttlSeconds?: number;
}

export async function readThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: ReadThroughOptions = {},
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return fetcher(); // no store: pure pass-through; a failure propagates to the caller

  const baseKey = `last-good:${key}`;
  const preview = isPreviewDeployment();
  const storeKey = preview ? `${previewCachePrefix()}${baseKey}` : baseKey;

  let fresh: T;
  try {
    fresh = await fetcher();
  } catch (err) {
    console.warn(`[last-good] fetch failed for ${key}, serving stored value:`, err);
    try {
      const stored = await redis.get<T>(storeKey);
      if (stored != null || !preview) return stored ?? null;
    } catch (readErr) {
      console.error(`[last-good] store read also failed for ${key}:`, readErr);
      if (!preview) return null;
    }
    try {
      return (await redis.get<T>(baseKey)) ?? null;
    } catch (readErr) {
      console.error(`[last-good] snapshot read also failed for ${key}:`, readErr);
      return null;
    }
  }

  // A failed write never fails the request — fresh data is returned regardless.
  try {
    if (preview) {
      const ttl = opts.ttlSeconds && opts.ttlSeconds > 0 ? Math.min(opts.ttlSeconds, 604800) : 604800;
      await redis.set(storeKey, fresh, { ex: ttl });
    } else if (opts.ttlSeconds) await redis.set(storeKey, fresh, { ex: opts.ttlSeconds });
    else await redis.set(storeKey, fresh);
  } catch (err) {
    console.warn(`[last-good] store write failed for ${key} (returning fresh anyway):`, err);
  }
  return fresh;
}
