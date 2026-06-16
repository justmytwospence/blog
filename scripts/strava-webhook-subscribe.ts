/**
 * Ops helper for the Strava push-subscription lifecycle. Run locally via tsx.
 *
 *   npm run webhook:subscribe        # create the subscription (one-time)
 *   npm run webhook:view             # show the current subscription
 *   npm run webhook:delete <id>      # tear it down
 *
 * `subscribe` triggers Strava's validation handshake against the deployed callback,
 * so the route must be live AND STRAVA_VERIFY_TOKEN must be set in Vercel *and*
 * locally (.env.local) before running it — Strava echoes the token to the callback,
 * which compares it against the Vercel-side value.
 */
import { loadEnvLocal, getCreds } from './strava-shared';

const API = 'https://www.strava.com/api/v3/push_subscriptions';
const CALLBACK_URL = 'https://spencerboucher.com/api/strava/webhook';

async function subscribe(): Promise<void> {
  const { clientId, clientSecret } = getCreds();
  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;
  if (!verifyToken) {
    throw new Error(
      '[webhook] STRAVA_VERIFY_TOKEN is not set (add it to .env.local and Vercel env first)',
    );
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: CALLBACK_URL,
    verify_token: verifyToken,
  });

  const res = await fetch(API, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[webhook] subscribe failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as { id?: number };
  console.log(`[webhook] subscription created. id = ${json.id}`);
  console.log('[webhook] set this as STRAVA_SUBSCRIPTION_ID in Vercel env.');
}

async function view(): Promise<void> {
  const { clientId, clientSecret } = getCreds();
  const url = `${API}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[webhook] view failed: ${res.status} ${text}`);
  }
  console.log(text);
}

async function remove(id: string): Promise<void> {
  const { clientId, clientSecret } = getCreds();
  const url = `${API}/${encodeURIComponent(id)}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    throw new Error(`[webhook] delete failed: ${res.status} ${await res.text()}`);
  }
  console.log(`[webhook] subscription ${id} deleted.`);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const [cmd, arg] = process.argv.slice(2);

  switch (cmd) {
    case 'subscribe':
      await subscribe();
      break;
    case 'view':
      await view();
      break;
    case 'delete':
      if (!arg) throw new Error('[webhook] usage: webhook:delete <id>');
      await remove(arg);
      break;
    default:
      console.error('Usage: tsx scripts/strava-webhook-subscribe.ts <subscribe|view|delete <id>>');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
