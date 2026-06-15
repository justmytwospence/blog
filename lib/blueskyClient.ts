/**
 * Browser-only AT Protocol OAuth client.
 *
 * This module imports `@atproto/oauth-client-browser`, which touches `window`,
 * `indexedDB` and `crypto.subtle` at use time. It must therefore only ever be
 * loaded in the browser — every importer pulls it in via a `dynamic(..., { ssr:
 * false })` boundary, and the client itself is constructed lazily (never at
 * module scope) so it is never evaluated during SSR/build.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { BLUESKY_SCOPE, BLUESKY_HANDLE_RESOLVER } from '@/lib/blueskyConfig';

let clientPromise: Promise<BrowserOAuthClient> | null = null;
let initPromise: ReturnType<BrowserOAuthClient['init']> | null = null;

function isLoopback(): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

async function createClient(): Promise<BrowserOAuthClient> {
  if (isLoopback()) {
    // Dev: a synthesized "loopback" client_id needs no hosted metadata file.
    // The redirect_uri and scope are encoded into the client_id query string.
    const redirectUri = `${window.location.origin}/bluesky/callback`;
    const clientId =
      `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(BLUESKY_SCOPE)}`;
    return BrowserOAuthClient.load({
      clientId,
      handleResolver: BLUESKY_HANDLE_RESOLVER,
    });
  }
  // Deployed (prod/preview/custom domain): the client_id is this origin's hosted
  // metadata document, which self-describes from the same origin — so OAuth works
  // wherever the app is served, not just one hardcoded domain.
  return BrowserOAuthClient.load({
    clientId: `${window.location.origin}/client-metadata.json`,
    handleResolver: BLUESKY_HANDLE_RESOLVER,
  });
}

/** Lazily create (once) and return the OAuth client for this page load. */
export function getBlueskyClient(): Promise<BrowserOAuthClient> {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}

/**
 * Initialize the client exactly once per page load: completes an OAuth callback
 * if the URL carries one, otherwise restores a stored session. Memoized so
 * concurrent callers (and React StrictMode double-invokes) share one result.
 */
export async function initBluesky() {
  const client = await getBlueskyClient();
  if (!initPromise) initPromise = client.init();
  const result = await initPromise;
  return { client, result };
}

/** The opaque `state` string handed back after a sign-in redirect, if any. */
export function readCallbackState(
  result: Awaited<ReturnType<BrowserOAuthClient['init']>>,
): string | null {
  const state = (result as { state?: unknown } | undefined)?.state;
  return typeof state === 'string' ? state : null;
}
