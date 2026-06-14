import { NextResponse } from 'next/server';
import { BLUESKY_SITE_ORIGIN, BLUESKY_SCOPE } from '@/lib/blueskyConfig';

// Prerender to a static CDN asset. The AT Protocol authorization server fetches
// this document during the OAuth flow, so it must be publicly readable and the
// `client_id` field must byte-for-byte equal the URL it is served from.
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(
    {
      client_id: `${BLUESKY_SITE_ORIGIN}/client-metadata.json`,
      client_name: 'Data Spencer',
      client_uri: BLUESKY_SITE_ORIGIN,
      redirect_uris: [`${BLUESKY_SITE_ORIGIN}/bluesky/callback`],
      scope: BLUESKY_SCOPE,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      // Public browser client: no secret, authenticates with PKCE + DPoP only.
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
