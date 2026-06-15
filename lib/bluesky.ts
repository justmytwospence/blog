/**
 * Bluesky / AT Protocol helpers for rendering a blog comment section from the
 * replies to a Bluesky post.
 *
 * The flow: the author publishes a Bluesky post that links to an article, then
 * adds that post's URL to the article frontmatter (`bluesky:`). At read time the
 * browser queries Bluesky's public AppView (no auth required) for the post's
 * reply thread and renders it as comments. Replying happens on Bluesky, so the
 * comment section is always live without rebuilding the site.
 *
 * Everything here is framework-agnostic and side-effect-free apart from the
 * explicit `fetch` helpers, so the parsing/segmentation logic is unit-tested.
 */

/** Public, unauthenticated AppView XRPC base. */
export const APPVIEW = 'https://public.api.bsky.app/xrpc';

/** A Bluesky account as embedded in a post view. */
export interface BlueskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/** Rich-text annotation over a byte range of the post text. */
export interface BlueskyFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: 'app.bsky.richtext.facet#link'; uri: string }
    | { $type: 'app.bsky.richtext.facet#mention'; did: string }
    | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
    | { $type: string; [k: string]: unknown }
  >;
}

/** The `app.bsky.feed.post` record itself. */
export interface BlueskyPostRecord {
  text: string;
  createdAt: string;
  facets?: BlueskyFacet[];
}

/** A hydrated image embed (the `#view` variant the AppView returns). */
export interface BlueskyImagesEmbed {
  $type: 'app.bsky.embed.images#view';
  images: Array<{
    thumb: string;
    fullsize: string;
    alt: string;
    aspectRatio?: { width: number; height: number };
  }>;
}

export interface BlueskyPostView {
  uri: string;
  cid: string;
  author: BlueskyAuthor;
  record: BlueskyPostRecord;
  embed?: BlueskyImagesEmbed | { $type: string; [k: string]: unknown };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt: string;
}

/** A node in the reply tree. The AppView tags each node with `$type`. */
export type ThreadNode =
  | {
      $type: 'app.bsky.feed.defs#threadViewPost';
      post: BlueskyPostView;
      replies?: ThreadNode[];
    }
  | { $type: 'app.bsky.feed.defs#notFoundPost'; uri: string; notFound: true }
  | {
      $type: 'app.bsky.feed.defs#blockedPost';
      uri: string;
      blocked: true;
      author?: { did: string };
    };

export interface GetPostThreadResponse {
  thread: ThreadNode;
}

export function isThreadViewPost(
  node: ThreadNode | undefined | null,
): node is Extract<ThreadNode, { post: BlueskyPostView }> {
  return !!node && node.$type === 'app.bsky.feed.defs#threadViewPost';
}

/** Components of a Bluesky post reference, before DID resolution. */
export interface ParsedPostRef {
  /** Either a DID or a handle — `kind` disambiguates. */
  actor: string;
  kind: 'did' | 'handle';
  rkey: string;
}

/**
 * Parse a Bluesky post reference from either a bsky.app web URL or an at:// URI.
 *
 * Accepts:
 *   https://bsky.app/profile/{handle|did}/post/{rkey}
 *   at://{did|handle}/app.bsky.feed.post/{rkey}
 *
 * Returns null if the input is not a recognizable post reference.
 */
export function parsePostRef(input: string): ParsedPostRef | null {
  const trimmed = input.trim();

  // at:// URI form
  if (trimmed.startsWith('at://')) {
    const rest = trimmed.slice('at://'.length);
    const parts = rest.split('/');
    // [actor, collection, rkey]
    if (parts.length === 3 && parts[1] === 'app.bsky.feed.post' && parts[2]) {
      const actor = parts[0];
      return { actor, kind: actor.startsWith('did:') ? 'did' : 'handle', rkey: parts[2] };
    }
    return null;
  }

  // web URL form
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/,
  );
  if (match) {
    const actor = decodeURIComponent(match[1]);
    const rkey = match[2];
    return { actor, kind: actor.startsWith('did:') ? 'did' : 'handle', rkey };
  }

  return null;
}

/** Build an at:// post URI from a DID and rkey. */
export function toAtUri(did: string, rkey: string): string {
  return `at://${did}/app.bsky.feed.post/${rkey}`;
}

/** Resolve a handle (e.g. `alice.bsky.social`) to its DID via the AppView. */
export async function resolveHandleToDid(
  handle: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${APPVIEW}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to resolve handle ${handle} (${res.status})`);
  }
  const data = (await res.json()) as { did?: string };
  if (!data.did) throw new Error(`No DID returned for handle ${handle}`);
  return data.did;
}

/**
 * Resolve any supported post reference to a canonical at:// URI, resolving the
 * handle to a DID when necessary.
 */
export async function resolveToAtUri(
  input: string,
  signal?: AbortSignal,
): Promise<string> {
  const ref = parsePostRef(input);
  if (!ref) throw new Error(`Not a Bluesky post reference: ${input}`);
  const did = ref.kind === 'did' ? ref.actor : await resolveHandleToDid(ref.actor, signal);
  return toAtUri(did, ref.rkey);
}

/** The bsky.app web URL for a post, used for "reply / like on Bluesky" links. */
export function postWebUrl(author: BlueskyAuthor, atUri: string): string {
  const rkey = atUri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${author.handle}/post/${rkey}`;
}

/**
 * Fetch a post's reply thread from the public AppView. `parentHeight=0` because
 * a comment section only cares about descendants, not the post's ancestors.
 */
export async function getPostThread(
  atUri: string,
  { depth = 10, signal }: { depth?: number; signal?: AbortSignal } = {},
): Promise<GetPostThreadResponse> {
  const url =
    `${APPVIEW}/app.bsky.feed.getPostThread` +
    `?uri=${encodeURIComponent(atUri)}&depth=${depth}&parentHeight=0`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load thread (${res.status})`);
  }
  return (await res.json()) as GetPostThreadResponse;
}

/** A piece of post text, optionally carrying a link/mention/tag annotation. */
export interface RichTextSegment {
  text: string;
  link?: { type: 'uri' | 'mention' | 'tag'; value: string };
}

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

/**
 * Convert post text + facets into renderable segments.
 *
 * Facet offsets (`byteStart`/`byteEnd`) index into the UTF-8 *byte* encoding of
 * the text, NOT JavaScript's UTF-16 string indices. Slicing the string directly
 * corrupts any text containing emoji or non-ASCII characters, so we slice the
 * encoded byte array and decode each piece back to a string.
 */
export function richTextToSegments(
  text: string,
  facets?: BlueskyFacet[],
): RichTextSegment[] {
  if (!facets || facets.length === 0 || !encoder || !decoder) {
    return [{ text }];
  }

  const bytes = encoder.encode(text);
  const slice = (start: number, end: number) =>
    decoder.decode(bytes.subarray(start, end));

  // Keep facets in order and skip malformed/overlapping ranges defensively.
  const sorted = [...facets]
    .filter((f) => f.index && f.index.byteEnd > f.index.byteStart)
    .sort((a, b) => a.index.byteStart - b.index.byteStart);

  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < cursor) continue; // overlap — ignore
    if (byteStart > cursor) segments.push({ text: slice(cursor, byteStart) });

    const feature = facet.features?.[0];
    const facetText = slice(byteStart, byteEnd);
    let link: RichTextSegment['link'] | undefined;
    if (feature?.$type === 'app.bsky.richtext.facet#link') {
      const uri = (feature as { uri: string }).uri;
      // Only honor http(s) links; anything else (e.g. javascript:) renders as
      // plain text so a malicious reply can't inject a dangerous href.
      if (/^https?:\/\//i.test(uri)) link = { type: 'uri', value: uri };
    } else if (feature?.$type === 'app.bsky.richtext.facet#mention') {
      link = { type: 'mention', value: (feature as { did: string }).did };
    } else if (feature?.$type === 'app.bsky.richtext.facet#tag') {
      link = { type: 'tag', value: (feature as { tag: string }).tag };
    }
    segments.push(link ? { text: facetText, link } : { text: facetText });
    cursor = byteEnd;
  }

  if (cursor < bytes.length) segments.push({ text: slice(cursor, bytes.length) });
  return segments;
}

/** Resolve a rich-text segment's annotation to a clickable href. */
export function segmentHref(link: NonNullable<RichTextSegment['link']>): string {
  switch (link.type) {
    case 'uri':
      return link.value;
    case 'mention':
      return `https://bsky.app/profile/${link.value}`;
    case 'tag':
      return `https://bsky.app/hashtag/${encodeURIComponent(link.value)}`;
  }
}

/**
 * Pin replies (a bare 📌, sometimes with whitespace) are how people pin their
 * own post to the top of a thread. They are noise in a comment section, so we
 * drop them — matching the convention of the reference Bluesky comment widgets.
 */
export function isPinPost(node: ThreadNode): boolean {
  if (!isThreadViewPost(node)) return false;
  const text = node.post.record.text ?? '';
  return text.replace(/\s/g, '') === '📌';
}

export type SortMode = 'top' | 'newest' | 'oldest';

/** Order reply nodes; non-post nodes (blocked/not-found) sink to the end. */
export function sortReplies(replies: ThreadNode[], mode: SortMode): ThreadNode[] {
  const posts = replies.filter(isThreadViewPost);
  const others = replies.filter((r) => !isThreadViewPost(r));

  const sorted = [...posts].sort((a, b) => {
    if (mode === 'top') {
      const byLikes = (b.post.likeCount ?? 0) - (a.post.likeCount ?? 0);
      if (byLikes !== 0) return byLikes;
      // tie-break: more replies, then newer
      const byReplies = (b.post.replyCount ?? 0) - (a.post.replyCount ?? 0);
      if (byReplies !== 0) return byReplies;
    }
    const at = new Date(a.post.indexedAt).getTime();
    const bt = new Date(b.post.indexedAt).getTime();
    return mode === 'oldest' ? at - bt : bt - at;
  });

  return [...sorted, ...others];
}

/** Total number of rendered (post) replies anywhere in the tree. */
export function countReplies(nodes: ThreadNode[] | undefined): number {
  if (!nodes) return 0;
  let total = 0;
  for (const node of nodes) {
    if (isThreadViewPost(node)) {
      total += 1 + countReplies(node.replies);
    }
  }
  return total;
}
