/**
 * Strava webhook callback.
 *
 * GET  — the subscription validation handshake. Strava fires this (within the
 *        `POST /push_subscriptions` create call) and expects the challenge echoed
 *        back within 2s. We only echo when `hub.verify_token` matches our secret.
 * POST — the activity event stream. We filter aggressively, then fire a GitHub
 *        `repository_dispatch` to kick the `strava-sync` workflow. We always return
 *        200 quickly (Strava requires <2s and retries non-200s, which are harmless).
 *
 * No DB writes, no external dependencies — a spoofed POST at worst triggers an
 * idempotent, parameter-less sync.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPO = 'justmytwospence/blog';

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

  if (
    mode === 'subscribe' &&
    verifyToken &&
    verifyToken === process.env.STRAVA_VERIFY_TOKEN
  ) {
    return Response.json({ 'hub.challenge': challenge });
  }

  return new Response('Forbidden', { status: 403 });
}

/** Activity event stream. Always returns 200 quickly; real work happens in the Action. */
export async function POST(request: Request): Promise<Response> {
  let event: StravaEvent;
  try {
    event = (await request.json()) as StravaEvent;
  } catch {
    // Malformed body — ack and move on; Strava retries are harmless.
    return new Response('ok', { status: 200 });
  }

  const relevant =
    event?.object_type === 'activity' &&
    (event.aspect_type === 'create' ||
      event.aspect_type === 'update' ||
      event.aspect_type === 'delete');

  if (!relevant) {
    return new Response('ignored', { status: 200 });
  }

  // If we know our subscription id, require the event to match it.
  const expectedSub = process.env.STRAVA_SUBSCRIPTION_ID;
  if (expectedSub && String(event.subscription_id) !== expectedSub) {
    return new Response('ignored', { status: 200 });
  }

  // Fire-and-forget the GitHub repository_dispatch. Never let a dispatch failure
  // turn into a non-200 — Strava would just retry, so we log and ack regardless.
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'strava-activity' }),
    });
    if (!res.ok) {
      console.error(
        `[strava-webhook] repository_dispatch failed: ${res.status} ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error('[strava-webhook] repository_dispatch error:', err);
  }

  return new Response('ok', { status: 200 });
}
