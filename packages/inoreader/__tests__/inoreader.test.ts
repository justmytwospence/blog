import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Archive</title>${items}</channel></rss>`;
}

function item(opts: { title: string; link: string; source: string; sourceUrl: string }): string {
  return `<item>
    <title>${opts.title}</title>
    <link>${opts.link}</link>
    <description>Some body text.</description>
    <pubDate>Mon, 27 Jul 2026 12:00:00 GMT</pubDate>
    <source url="${opts.sourceUrl}">${opts.source}</source>
    <category>Archive</category>
  </item>`;
}

function mockFeed(xml: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => xml,
  });
}

describe('inoreader blogroll client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('keeps numeric titles and attributed elements as text instead of failing the stream', async () => {
    mockFeed(
      rss(
        item({ title: '2026', link: 'https://example.com/a', source: '1984', sourceUrl: 'https://example.com/' }) +
          `<item>
            <title type="html">Attributed &amp; titled</title>
            <link>https://example.com/b</link>
            <description type="html">Body</description>
            <dc:creator>42</dc:creator>
            <source url="https://example.com/">Example</source>
          </item>`,
      ),
    );

    const { getBlogrollFeedsOrThrow, getBlogrollItemsOrThrow } = await import('../src');
    const items = await getBlogrollItemsOrThrow();
    expect(items.map((i) => i.title)).toEqual(['2026', 'Attributed & titled']);
    expect(items[0].sourceName).toBe('1984');
    expect(items[1].author).toBe('42');
    await expect(getBlogrollFeedsOrThrow()).resolves.toHaveLength(1); // one source
  });

  it('drops items from the Reddit feed by source name', async () => {
    mockFeed(
      rss(
        item({ title: 'Reddit post', link: 'https://old.reddit.com/r/x/1', source: 'Reddit', sourceUrl: 'https://www.reddit.com/r/x/' }) +
          item({ title: 'Real post', link: 'https://xkcd.com/1', source: 'xkcd', sourceUrl: 'https://xkcd.com/' }),
      ),
    );

    const { getBlogrollItemsOrThrow } = await import('../src');
    const items = await getBlogrollItemsOrThrow();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Real post');
  });

  it('drops reddit items whose source title does not say "reddit"', async () => {
    mockFeed(
      rss(
        item({ title: 'Subreddit post', link: 'https://www.reddit.com/r/running/1', source: 'r/running', sourceUrl: 'https://www.reddit.com/r/running/.rss' }),
      ),
    );

    const { getBlogrollItemsOrThrow } = await import('../src');
    expect(await getBlogrollItemsOrThrow()).toEqual([]);
  });

  it('does not block sources that merely contain "reddit" in a path', async () => {
    mockFeed(
      rss(
        item({ title: 'Meta post', link: 'https://example.com/1', source: 'Example', sourceUrl: 'https://example.com/reddit-clone/' }),
      ),
    );

    const { getBlogrollItemsOrThrow } = await import('../src');
    expect(await getBlogrollItemsOrThrow()).toHaveLength(1);
  });

  it('honours INOREADER_SOURCE_BLOCKLIST as a full override', async () => {
    vi.stubEnv('INOREADER_SOURCE_BLOCKLIST', 'hacker news');
    mockFeed(
      rss(
        item({ title: 'Reddit post', link: 'https://www.reddit.com/r/x/1', source: 'Reddit', sourceUrl: 'https://www.reddit.com/r/x/' }) +
          item({ title: 'HN post', link: 'https://news.ycombinator.com/1', source: 'Hacker News: Best', sourceUrl: 'https://news.ycombinator.com/best' }),
      ),
    );

    const { getBlogrollItemsOrThrow } = await import('../src');
    const items = await getBlogrollItemsOrThrow();

    expect(items.map((i) => i.title)).toEqual(['Reddit post']);
  });

  it('disables the filter when INOREADER_SOURCE_BLOCKLIST is empty', async () => {
    vi.stubEnv('INOREADER_SOURCE_BLOCKLIST', '');
    mockFeed(
      rss(
        item({ title: 'Reddit post', link: 'https://www.reddit.com/r/x/1', source: 'Reddit', sourceUrl: 'https://www.reddit.com/r/x/' }),
      ),
    );

    const { getBlogrollItemsOrThrow } = await import('../src');
    expect(await getBlogrollItemsOrThrow()).toHaveLength(1);
  });
});
