/**
 * One-time (or break-glass) seed of the runtime store, so the live /adventures page shows real
 * numbers immediately instead of "0 all-time" until the first webhook fires.
 *
 * Pull the Upstash creds into your env first (e.g. `vercel env pull .env.local`), then:
 *   npm run seed:redis
 */
import { Redis } from '@upstash/redis';
import { mintAccessToken, crawlActivities, buildTotals } from '@blog/strava';
import { loadEnvLocal, getCreds } from './strava-shared';

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Set UPSTASH_REDIS_REST_URL/TOKEN (run `vercel env pull .env.local`) before seeding.');
  }
  const redis = new Redis({ url, token });

  const t = await mintAccessToken(getCreds());
  const entries = await crawlActivities(t.accessToken);
  const totals = buildTotals(entries);

  await redis.set('strava:totals', totals);
  await redis.set('strava:auth', {
    refreshToken: t.refreshToken,
    accessToken: t.accessToken,
    expiresAt: t.expiresAt,
  });
  console.log(
    `[seed:redis] wrote strava:totals (${totals.lifetime.activityCount} human-powered) + strava:auth`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
