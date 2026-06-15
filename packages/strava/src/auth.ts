/**
 * Strava OAuth: mint a short-lived access token from a long-lived refresh token.
 *
 * IMPORTANT: Strava MAY rotate the refresh token on any refresh (returning a new one and
 * invalidating the old). `rotated` flags that; the caller (sync script) must persist the new
 * token or subsequent runs will fail with invalid_grant.
 */

import type { TokenResult } from './types';

const TOKEN_URL = 'https://www.strava.com/oauth/token';

export async function mintAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[strava] token refresh failed: ${res.status} ${res.statusText} ${body}`.trim());
  }

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };

  if (!json.access_token || !json.refresh_token) {
    throw new Error('[strava] token refresh response missing tokens');
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at ?? 0,
    rotated: json.refresh_token !== opts.refreshToken,
  };
}
