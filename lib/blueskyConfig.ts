/**
 * Shared Bluesky OAuth configuration constants.
 *
 * This module intentionally imports NOTHING from the browser-only
 * `@atproto/oauth-client-browser` package so it can be safely imported by both
 * the server-side client-metadata route and the browser OAuth client.
 */

/**
 * OAuth scope. `atproto` alone is read-only; `transition:generic` is required
 * to create the reply record. The scope here, in the served metadata, and the
 * scope requested at sign-in must all agree.
 */
export const BLUESKY_SCOPE = 'atproto transition:generic';

/** Handle -> DID resolver service (DNS resolution is impossible in-browser). */
export const BLUESKY_HANDLE_RESOLVER = 'https://bsky.social';
