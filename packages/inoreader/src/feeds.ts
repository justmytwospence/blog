/**
 * The blogroll's FEED list, as opposed to its item list.
 *
 * Derived from the same public tag stream — no credentials, no quota, nothing to configure. The
 * stream is crawled at its maximum depth (`FEED_CRAWL_COUNT`) and collapsed to one entry per source,
 * so the sidebar and the OPML download cover every feed that has published into the tag, not just
 * the handful on the first page.
 *
 * The honest limit: Inoreader's public stream caps at 1000 items (~10 weeks of history) and offers
 * no pagination, so a subscribed feed that has published nothing in that window cannot be seen. The
 * only way to enumerate silent feeds is the authenticated `subscription/list` endpoint, which needs
 * an OAuth app and burns a 100/day quota.
 */

import type { BlogrollItem } from './index';

/** Inoreader's public stream returns at most 1000 items however large `n` is — asking for more is free. */
export const FEED_CRAWL_COUNT = 1000;

/** One feed in the blogroll, collapsed from every stream item that came from it. */
export interface BlogrollFeed {
  /** Stable key — the source domain, which is also how items are matched back to their feed. */
  id: string;
  title: string;
  /**
   * What Inoreader advertises as the source URL. Sometimes the site, sometimes the XML feed itself
   * (Inoreader prefers the feed's declared site link and falls back to the subscription URL), which
   * is why OPML export emits it as both `xmlUrl` and `htmlUrl` and leans on reader auto-discovery.
   */
  url: string;
  /** Tags the feed's items carried — the closest thing the public stream has to Inoreader folders. */
  folders: string[];
  /** How many items this feed contributed to the crawl. */
  itemCount: number;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Collapse items to one entry per source feed, unioning their tags and counting their items.
 * Sorted by title so the sidebar and the OPML agree on order.
 */
export function deriveFeeds(items: BlogrollItem[]): BlogrollFeed[] {
  const byDomain = new Map<string, BlogrollFeed>();

  for (const item of items) {
    const url = item.sourceUrl || item.url;
    const id = domainOf(url);
    const title = item.sourceName?.trim() || id;

    const existing = byDomain.get(id);
    if (!existing) {
      byDomain.set(id, { id, title, url, folders: [...item.categories], itemCount: 1 });
      continue;
    }

    existing.itemCount += 1;
    // Prefer a real title over the bare domain, and union the tags seen across the feed's items.
    if (existing.title === id && title !== id) existing.title = title;
    for (const cat of item.categories) {
      if (!existing.folders.includes(cat)) existing.folders.push(cat);
    }
  }

  return Array.from(byDomain.values()).sort((a, b) => a.title.localeCompare(b.title));
}

// ─── OPML ──────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function feedOutline(feed: BlogrollFeed, indent: string): string {
  const url = escapeXml(feed.url);
  const title = escapeXml(feed.title);
  return `${indent}<outline type="rss" text="${title}" title="${title}" xmlUrl="${url}" htmlUrl="${url}"/>`;
}

/**
 * Serialize feeds to OPML 2.0, nested under their tags (a feed tagged two ways appears under both,
 * which is what Inoreader's own export does). Untagged feeds follow as top-level outlines.
 *
 * `dateCreated` is injected rather than read from the clock so the output is deterministic in tests.
 */
export function buildOpml(
  feeds: BlogrollFeed[],
  opts: { title: string; ownerName?: string; dateCreated?: string },
): string {
  const byFolder = new Map<string, BlogrollFeed[]>();
  const rootFeeds: BlogrollFeed[] = [];

  for (const feed of feeds) {
    if (feed.folders.length === 0) {
      rootFeeds.push(feed);
      continue;
    }
    for (const folder of feed.folders) {
      const bucket = byFolder.get(folder);
      if (bucket) bucket.push(feed);
      else byFolder.set(folder, [feed]);
    }
  }

  const body = [
    ...Array.from(byFolder.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, folderFeeds]) =>
        [
          `    <outline text="${escapeXml(folder)}" title="${escapeXml(folder)}">`,
          ...folderFeeds.map((feed) => feedOutline(feed, '      ')),
          '    </outline>',
        ].join('\n'),
      ),
    ...rootFeeds.map((feed) => feedOutline(feed, '    ')),
  ].join('\n');

  const head = [
    `    <title>${escapeXml(opts.title)}</title>`,
    ...(opts.dateCreated ? [`    <dateCreated>${escapeXml(opts.dateCreated)}</dateCreated>`] : []),
    ...(opts.ownerName ? [`    <ownerName>${escapeXml(opts.ownerName)}</ownerName>`] : []),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
${head}
  </head>
  <body>
${body}
  </body>
</opml>
`;
}
