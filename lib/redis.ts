/**
 * Shared, lazy, env-gated Upstash Redis client.
 *
 * The Vercel Upstash integration injects either UPSTASH_* or the legacy KV_* names. With no Redis
 * env (CI build, a fresh clone, local dev without creds pulled) nothing is constructed and callers
 * degrade gracefully. Used by the Strava runtime store (lib/strava-store.ts) and the last-good
 * read-through cache (lib/last-good.ts) so there is one client and one place that knows the env.
 */
import { Redis } from '@upstash/redis';

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let cachedClient: Redis | null | undefined;

/** The Upstash client, or null when no Redis env is configured. Constructed once, lazily. */
export function getRedis(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;
  const env = redisEnv();
  cachedClient = env ? new Redis(env) : null;
  return cachedClient;
}

/** True when a Redis store is configured (production, or a dev env with creds pulled). */
export function hasStore(): boolean {
  return redisEnv() !== null;
}
