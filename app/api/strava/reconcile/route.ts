/**
 * Daily reconcile safety-net for the Strava totals.
 *
 * Strava retries a webhook event ~3x then gives up; a dropped final event would otherwise leave the
 * totals stale until the next activity (possibly weeks for an adventure blog). This cron recomputes
 * the totals from a full crawl once a day — the same work as the webhook's `after()` block (see
 * `recomputeTotals()` in lib/strava-store.ts).
 *
 * NOT a clean no-op without credentials: recomputeTotals mints a Strava token first, so a deployment
 * missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN returns 500. With Strava
 * creds but no Redis it completes the full crawl and then discards the result (writeTotals logs and
 * skips) — wasted work rather than an error.
 *
 * Guarded so it isn't publicly triggerable: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * when CRON_SECRET is set (and an internal `x-vercel-cron` header). Set CRON_SECRET in production.
 */
import { recomputeTotals } from '@/lib/strava-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }
  // No secret configured: fall back to Vercel's internal cron header (absent on external requests).
  return request.headers.has('x-vercel-cron');
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    await recomputeTotals();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[strava-reconcile] failed:', err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
