/**
 * Inoreader RSS client
 *
 * Fetches blogroll data from a public Inoreader RSS feed at build time.
 * Returns an empty array on failure so the build never breaks.
 */

import { XMLParser } from 'fast-xml-parser';

// ─── Constants ─────────────────────────────────────────────────────

const FEED_URL = 'https://www.inoreader.com/stream/user/1003561864/tag/Archive';

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

function normalizeCategories(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const cats = Array.isArray(raw) ? raw : [raw];
  return cats.filter((c) => c !== 'Archive');
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
  const plainText = stripHtml(description);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;

  return {
    title: raw.title,
    url: raw.link,
    author: raw['dc:creator'] ?? null,
    sourceName: typeof raw.source === 'string' ? raw.source : null,
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
  try {
    const res = await fetch(FEED_URL);

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
  }
}
