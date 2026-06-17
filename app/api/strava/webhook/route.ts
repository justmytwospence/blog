/**
 * Strava webhook callback.
 *
 * GET  — the subscription validation handshake; we echo `hub.challenge` only when
 *        `hub.verify_token` matches our secret.
 * POST — an activity event. We ack 200 within Strava's 2s window, then (in `after()`) recompute the
 *        totals from a Strava crawl, write them to the runtime store, and revalidate the page.
 *        Nothing is committed to git. A failed refresh self-heals on the next event.
 */
import { after } from 'next/server';
import { recomputeTotals } from '@/lib/strava-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface StravaEvent {
  object_type?: string;
  aspect_type?: string;
  subscription_id?: number;
}

/** Subscription validation handshake. */
export function GET(request: Request): Response {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && verifyToken && verifyToken === process.env.STRAVA_VERIFY_TOKEN) {
    return Response.json({ 'hub.challenge': challenge });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Activity event. Always 200s fast; the refresh runs after the response. */
export async function POST(request: Request): Promise<Response> {
  let event: StravaEvent;
  try {
    event = (await request.json()) as StravaEvent;
  } catch {
    return new Response('ok', { status: 200 });
  }

  const relevant =
    event?.object_type === 'activity' &&
    (event.aspect_type === 'create' || event.aspect_type === 'update' || event.aspect_type === 'delete');
  if (!relevant) {
    return new Response('ignored', { status: 200 });
  }

  const expectedSub = process.env.STRAVA_SUBSCRIPTION_ID;
  if (expectedSub && String(event.subscription_id) !== expectedSub) {
    return new Response('ignored', { status: 200 });
  }

  // Recompute totals out-of-band so the 200 beats Strava's ~2s timeout. Bounded by maxDuration; a
  // throttled/failed crawl just logs and self-heals on the next event or the daily reconcile cron.
  after(async () => {
    try {
      await recomputeTotals();
    } catch (err) {
      console.error('[strava-webhook] totals refresh failed:', err);
    }
  });

  return new Response('ok', { status: 200 });
}
