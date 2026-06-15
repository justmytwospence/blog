import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BLUESKY_SCOPE } from '@/lib/blueskyConfig';

// The AT Protocol authorization server fetches this document during the OAuth
// flow, and the `client_id` field must byte-for-byte equal the URL it is served
// from. We therefore self-describe from the request origin so the same code
// works on production, Vercel previews, and any custom domain.
export const dynamic = 'force-dynamic';

export async function GET() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'spencerboucher.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  return NextResponse.json(
    {
      client_id: `${origin}/client-metadata.json`,
      client_name: 'Data Spencer',
      client_uri: origin,
      redirect_uris: [`${origin}/bluesky/callback`],
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
