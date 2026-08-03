import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deriveFeeds, buildOpml, type BlogrollFeed } from '../src/feeds';
import type { BlogrollItem } from '../src';

function item(overrides: Partial<BlogrollItem>): BlogrollItem {
  return {
    title: 'A post',
    url: 'https://example.com/post',
    author: null,
    sourceName: null,
    sourceUrl: null,
    publishedDate: '',
    summary: '',
    categories: [],
    readingTime: null,
    ...overrides,
  };
}

describe('deriveFeeds', () => {
  it('collapses items to one feed per domain, counting items and unioning tags', () => {
    const feeds = deriveFeeds([
      item({ url: 'https://xkcd.com/1', sourceUrl: 'https://xkcd.com/', sourceName: 'xkcd', categories: ['Fun'] }),
      item({ url: 'https://xkcd.com/2', sourceUrl: 'https://xkcd.com/', sourceName: 'xkcd', categories: ['Comics'] }),
    ]);

    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ id: 'xkcd.com', title: 'xkcd', itemCount: 2, folders: ['Fun', 'Comics'] });
  });

  it('treats www and bare hosts as one feed', () => {
    const feeds = deriveFeeds([
      item({ url: 'https://www.dezeen.com/a', sourceUrl: 'https://www.dezeen.com/', sourceName: 'Dezeen' }),
      item({ url: 'https://dezeen.com/b', sourceUrl: 'https://dezeen.com/', sourceName: 'Dezeen' }),
    ]);

    expect(feeds).toHaveLength(1);
    expect(feeds[0].itemCount).toBe(2);
  });

  it('prefers a real source name over the bare domain', () => {
    const feeds = deriveFeeds([
      item({ url: 'https://lobste.rs/s/1', sourceUrl: 'https://lobste.rs/' }),
      item({ url: 'https://lobste.rs/s/2', sourceUrl: 'https://lobste.rs/', sourceName: 'Lobsters' }),
    ]);

    expect(feeds.map((f) => f.title)).toEqual(['Lobsters']);
  });

  it('falls back to the item URL when the item carries no source', () => {
    const feeds = deriveFeeds([item({ url: 'https://www.example.com/a' })]);

    expect(feeds[0].id).toBe('example.com');
    expect(feeds[0].title).toBe('example.com');
  });

  it('sorts by title', () => {
    const feeds = deriveFeeds([
      item({ url: 'https://z.com/1', sourceUrl: 'https://z.com/', sourceName: 'Zeta' }),
      item({ url: 'https://a.com/1', sourceUrl: 'https://a.com/', sourceName: 'Alpha' }),
    ]);

    expect(feeds.map((f) => f.title)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('buildOpml', () => {
  const feeds: BlogrollFeed[] = [
    { id: 'xkcd.com', title: 'xkcd', url: 'https://xkcd.com/', folders: ['Fun'], itemCount: 3 },
    { id: 'lobste.rs', title: 'Lobsters', url: 'https://lobste.rs/', folders: ['Tech', 'Fun'], itemCount: 4 },
    { id: 'a.com', title: 'Loose & "quoted"', url: 'https://a.com/f?x=1&y=2', folders: [], itemCount: 1 },
  ];

  it('nests feeds under tags, repeating a feed carrying two', () => {
    const opml = buildOpml(feeds, { title: 'Blogroll', ownerName: 'Spencer', dateCreated: 'Sat, 01 Aug 2026 00:00:00 GMT' });

    expect(opml).toContain('<outline text="Fun" title="Fun">');
    expect(opml).toContain('<outline text="Tech" title="Tech">');
    expect(opml.match(/title="Lobsters"/g)).toHaveLength(2);
    expect(opml).toContain('<ownerName>Spencer</ownerName>');
    expect(opml).toContain('<dateCreated>Sat, 01 Aug 2026 00:00:00 GMT</dateCreated>');
  });

  it('emits untagged feeds at the top level with escaped attributes', () => {
    const opml = buildOpml(feeds, { title: 'Blogroll' });

    expect(opml).toContain('xmlUrl="https://a.com/f?x=1&amp;y=2"');
    expect(opml).toContain('text="Loose &amp; &quot;quoted&quot;"');
    expect(opml).not.toContain('<dateCreated>');
  });

  it('is valid XML with one outline per feed-in-folder', () => {
    const opml = buildOpml(feeds, { title: 'Blogroll' });

    expect(opml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(opml.match(/<outline type="rss"/g)).toHaveLength(4); // xkcd + Lobsters×2 + untagged
    expect(opml.trimEnd().endsWith('</opml>')).toBe(true);
  });
});

describe('getBlogrollFeedsOrThrow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('crawls the stream at full depth and drops blocked sources', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => `<?xml version="1.0"?><rss version="2.0"><channel>
        <item><title>A</title><link>https://xkcd.com/1</link><source url="https://xkcd.com/">xkcd</source><category>Fun</category></item>
        <item><title>B</title><link>https://www.reddit.com/r/x/1</link><source url="https://www.reddit.com/r/x/">r/x</source></item>
      </channel></rss>`,
    });
    globalThis.fetch = fetchMock;

    const { getBlogrollFeedsOrThrow } = await import('../src');
    const feeds = await getBlogrollFeedsOrThrow();

    expect(feeds.map((f) => f.title)).toEqual(['xkcd']);
    expect(fetchMock.mock.calls[0][0]).toContain('n=1000');
  });
});
