/**
 * One-time OAuth bootstrap to obtain a long-lived refresh token with activity:read_all.
 *
 *   1. Set STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .env.local.
 *   2. npm run strava:bootstrap
 *   3. Open the printed URL, authorize, copy the `code` from the redirected localhost URL.
 *   4. Paste it; the script prints the refresh_token to add to .env.local + your secret store.
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadEnvLocal } from './strava-shared';

async function main(): Promise<void> {
  loadEnvLocal();
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local first.');
    process.exit(1);
  }

  const authUrl =
    `https://www.strava.com/oauth/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=http://localhost/exchange_token` +
    `&approval_prompt=force&scope=read,activity:read_all`;

  console.log('\n1) Open this URL and click Authorize:\n');
  console.log(authUrl);
  console.log(
    '\n2) You will be redirected to a dead http://localhost/exchange_token?...&code=... page.',
  );
  console.log('   Copy the value of `code` from the address bar.\n');

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question('Paste the code: ')).trim();
  rl.close();

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    console.error(`Token exchange failed: ${res.status} ${await res.text().catch(() => '')}`);
    process.exit(1);
  }
  const json = (await res.json()) as { refresh_token?: string; athlete?: { firstname?: string } };
  if (!json.refresh_token) {
    console.error('No refresh_token in response.');
    process.exit(1);
  }
  console.log(`\n✓ Authorized${json.athlete?.firstname ? ` as ${json.athlete.firstname}` : ''}.`);
  console.log('\nAdd this to .env.local (and your Vercel/CI secret store):\n');
  console.log(`STRAVA_REFRESH_TOKEN=${json.refresh_token}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
