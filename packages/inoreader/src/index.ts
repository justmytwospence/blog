/**
 * Inoreader RSS client
 *
 * Fetches blogroll data from a public Inoreader RSS feed (zero API quota — it's a public stream, no
 * credentials, nothing to configure). Two views of the same stream:
 *
 *  - `getBlogrollItems*`  the article list, at the configured depth (~100 items)
 *  - `getBlogrollFeeds*`  the FEED list, from a full-depth 1000-item crawl collapsed per source
 *
 * Two flavours of each: the plain one returns [] on failure (build-safe default); the `*OrThrow` one
 * throws on HTTP/network failure so the app layer can wrap it in the last-good cache (a returned []
 * looks like success to a read-through cache). An empty-but-valid feed returns [], not a throw.
 *
 * The feed identity is config, not hardcoded — see `inoreaderConfig()` and the env vars it reads.
 * Items from blocked sources (see `DEFAULT_SOURCE_BLOCKLIST`) are dropped before returning.
 */

import { XMLParser } from 'fast-xml-parser';
import { sourceBlocklist, isSourceBlocked } from './blocklist';

import { deriveFeeds, FEED_CRAWL_COUNT, type BlogrollFeed } from './feeds';

export { buildOpml, deriveFeeds, domainOf, FEED_CRAWL_COUNT, type BlogrollFeed } from './feeds';

// ─── Config ────────────────────────────────────────────────────────

/**
 * The blogroll feed identity. Defaults reproduce the current public "Archive" stream so absent env
 * = unchanged behavior. Read at request time (not module load) so ISR revalidations see current env.
 *
 *  - INOREADER_USER_ID         the Inoreader numeric user id whose tag stream is public
 *  - INOREADER_PUBLIC_TAG      the tag marked public in Inoreader (also stripped from filter chips)
 *  - INOREADER_FEED_ITEM_COUNT how many items the stream returns (`n`); deeper history = more scroll
 */
function inoreaderConfig(): { userId: string; publicTag: string; itemCount: number } {
  return {
    userId: process.env.INOREADER_USER_ID ?? '1003561864',
    publicTag: process.env.INOREADER_PUBLIC_TAG ?? 'Archive',
    itemCount: Number(process.env.INOREADER_FEED_ITEM_COUNT) || 100,
  };
}

function buildFeedUrl(itemCount: number): string {
  const { userId, publicTag } = inoreaderConfig();
  return `https://www.inoreader.com/stream/user/${userId}/tag/${encodeURIComponent(publicTag)}?n=${itemCount}`;
}


// ─── Types ─────────────────────────────────────────────────────────

export interface BlogrollItem {
  title: string;
  url: string;
  author: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedDate: string;
  summary: string;
  categories: string[];
  readingTime: number | null;
}

interface RawRssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  'dc:creator'?: string;
  source?: string;
  category?: string | string[];
  guid?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * Decode the common HTML entities (named + numeric) found in feed titles and
 * summaries. fast-xml-parser only decodes XML entities, so e.g. &rsquo; or
 * &ecirc; would otherwise render literally (e.g. "Bri&rsquo;s Substack").
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', middot: '·',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', aacute: 'á',
  ouml: 'ö', uuml: 'ü', iuml: 'ï', ccedil: 'ç',
  ntilde: 'ñ', oslash: 'ø', aring: 'å', szlig: 'ß',
  copy: '©', reg: '®', trade: '™', deg: '°',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const cp =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function normalizeCategories(raw: string | string[] | undefined, publicTag: string): string[] {
  if (!raw) return [];
  const cats = Array.isArray(raw) ? raw : [raw];
  // Hide the marker tag itself — it's the filter, not a topic
  return cats.filter((c) => c !== publicTag);
}

/**
 * Inoreader exposes the article body via <description>. Some items are
 * URL-only stubs (HN-style) with ~10-20 words; others are full articles
 * with thousands. A 30-word floor skips the stubs without hiding short
 * but real posts. The minimum result is 1 min.
 */
function estimateReadingTime(wordCount: number): number | null {
  if (wordCount < 30) return null;
  return Math.max(1, Math.round(wordCount / 200));
}

function transformItem(
  raw: RawRssItem,
  sourceAttr: Record<string, string> | undefined,
  publicTag: string,
): BlogrollItem {
  const description = raw.description ?? '';
  const plainText = decodeEntities(stripHtml(description));
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;

  // <source url="...">Feed Title</source> parses to a string when it has no
  // attributes, or an object ({ '@_url', '#text' }) when it does — read the
  // feed title from whichever shape we got.
  const sourceName = typeof raw.source === 'string' ? raw.source : (sourceAttr?.['#text'] ?? null);

  return {
    title: decodeEntities(raw.title),
    url: raw.link,
    author: raw['dc:creator'] ? decodeEntities(raw['dc:creator']) : null,
    sourceName: sourceName ? decodeEntities(sourceName) : null,
    sourceUrl: sourceAttr?.['@_url'] ?? null,
    publishedDate: raw.pubDate ?? '',
    summary: truncate(plainText, 200),
    categories: normalizeCategories(raw.category, publicTag),
    readingTime: estimateReadingTime(wordCount),
  };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Core fetch. THROWS on HTTP/network failure (an empty-but-valid feed returns []).
 * `itemCount` is a parameter because the article list and the feed list want different depths: the
 * page renders ~100 items, while enumerating feeds wants the stream's full 1000-item ceiling.
 */
async function fetchStream(itemCount: number): Promise<BlogrollItem[]> {
  const { publicTag } = inoreaderConfig();
  const blocklist = sourceBlocklist();
  // Abort a hung feed so it can't stall page generation / ISR revalidation. The deep crawl moves
  // ~9MB of XML, so it gets a longer leash than the shallow one.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), itemCount > 200 ? 30_000 : 10_000);
  try {
    const res = await fetch(buildFeedUrl(itemCount), { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`[inoreader] Feed returned ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => name === 'item' || name === 'category',
    });

    const parsed = parser.parse(xml);
    const items: RawRssItem[] = parsed?.rss?.channel?.item ?? [];

    return items
      .map((item) => {
        // The source element may have attributes parsed separately
        const sourceAttr = typeof item.source === 'object' ? (item.source as unknown as Record<string, string>) : undefined;
        return transformItem(item, sourceAttr, publicTag);
      })
      .filter((item) => !isSourceBlocked(blocklist, item.sourceName, item.sourceUrl));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The article stream — as many items as `INOREADER_FEED_ITEM_COUNT` asks for.
 * THROWS so the app layer can wrap it in the last-good cache.
 */
export function getBlogrollItemsOrThrow(): Promise<BlogrollItem[]> {
  return fetchStream(inoreaderConfig().itemCount);
}

/**
 * Fetch all blogroll items from the Inoreader RSS feed.
 * Returns an empty array on any failure (the build-safe default).
 */
export async function getBlogrollItems(): Promise<BlogrollItem[]> {
  try {
    return await getBlogrollItemsOrThrow();
  } catch (err) {
    console.error('[inoreader] Fetch failed:', err);
    return [];
  }
}

/**
 * Every feed that has published into the public tag, from a full-depth crawl of the stream.
 * THROWS so the app layer can wrap it in the last-good cache.
 */
export async function getBlogrollFeedsOrThrow(): Promise<BlogrollFeed[]> {
  return deriveFeeds(await fetchStream(FEED_CRAWL_COUNT));
}

/** Feed list, [] on any failure (the build-safe default). */
export async function getBlogrollFeeds(): Promise<BlogrollFeed[]> {
  try {
    return await getBlogrollFeedsOrThrow();
  } catch (err) {
    console.error('[inoreader] Feed crawl failed:', err);
    return [];
  }
}
