/**
 * Inoreader RSS client
 *
 * Fetches blogroll data from a public Inoreader RSS feed at build time.
 * Returns an empty array on failure so the build never breaks.
 */

import { XMLParser } from 'fast-xml-parser';

// ─── Constants ─────────────────────────────────────────────────────

/**
 * The Inoreader user tag whose items become the blogroll. Marked public
 * in Inoreader, which makes the stream readable without auth. Stripped
 * from per-item categories so it doesn't show up as a UI filter chip.
 */
const PUBLIC_TAG = 'Archive';
const INOREADER_USER_ID = '1003561864';
// `n` controls how many items the stream returns (default 20); fetch a deeper
// history so the blogroll has enough to scroll through.
const FEED_ITEM_COUNT = 100;
const FEED_URL = `https://www.inoreader.com/stream/user/${INOREADER_USER_ID}/tag/${PUBLIC_TAG}?n=${FEED_ITEM_COUNT}`;

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

function normalizeCategories(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const cats = Array.isArray(raw) ? raw : [raw];
  // Hide the marker tag itself — it's the filter, not a topic
  return cats.filter((c) => c !== PUBLIC_TAG);
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

function transformItem(raw: RawRssItem, sourceAttr: Record<string, string> | undefined): BlogrollItem {
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
    categories: normalizeCategories(raw.category),
    readingTime: estimateReadingTime(wordCount),
  };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Fetch all blogroll items from the Inoreader RSS feed.
 * Returns an empty array on any failure.
 */
export async function getBlogrollItems(): Promise<BlogrollItem[]> {
  // Abort a hung feed so it can't stall page generation / ISR revalidation.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(FEED_URL, { signal: controller.signal });

    if (!res.ok) {
      console.error(`[inoreader] Feed returned ${res.status} ${res.statusText}`);
      return [];
    }

    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => name === 'item' || name === 'category',
    });

    const parsed = parser.parse(xml);
    const items: RawRssItem[] = parsed?.rss?.channel?.item ?? [];

    return items.map((item) => {
      // The source element may have attributes parsed separately
      const sourceAttr = typeof item.source === 'object' ? (item.source as unknown as Record<string, string>) : undefined;
      return transformItem(item, sourceAttr);
    });
  } catch (err) {
    console.error('[inoreader] Fetch failed:', err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
