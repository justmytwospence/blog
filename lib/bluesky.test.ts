import { describe, it, expect } from 'vitest';
import {
  parsePostRef,
  toAtUri,
  postWebUrl,
  richTextToSegments,
  segmentHref,
  sortReplies,
  countReplies,
  isPinPost,
  type ThreadNode,
  type BlueskyFacet,
} from './bluesky';

describe('parsePostRef', () => {
  it('parses a bsky.app URL with a handle', () => {
    expect(
      parsePostRef('https://bsky.app/profile/alice.bsky.social/post/3kabc'),
    ).toEqual({ actor: 'alice.bsky.social', kind: 'handle', rkey: '3kabc' });
  });

  it('parses a bsky.app URL with a DID', () => {
    expect(
      parsePostRef('https://bsky.app/profile/did:plc:xyz/post/3kabc'),
    ).toEqual({ actor: 'did:plc:xyz', kind: 'did', rkey: '3kabc' });
  });

  it('strips query strings and fragments from the rkey', () => {
    expect(
      parsePostRef('https://bsky.app/profile/alice.test/post/3kabc?foo=1#x')?.rkey,
    ).toBe('3kabc');
  });

  it('parses an at:// URI with a DID', () => {
    expect(parsePostRef('at://did:plc:xyz/app.bsky.feed.post/3kabc')).toEqual({
      actor: 'did:plc:xyz',
      kind: 'did',
      rkey: '3kabc',
    });
  });

  it('parses an at:// URI with a handle', () => {
    expect(
      parsePostRef('at://alice.bsky.social/app.bsky.feed.post/3kabc')?.kind,
    ).toBe('handle');
  });

  it('returns null for non-post references', () => {
    expect(parsePostRef('https://example.com/foo')).toBeNull();
    expect(parsePostRef('at://did:plc:xyz/app.bsky.feed.like/3kabc')).toBeNull();
    expect(parsePostRef('')).toBeNull();
  });
});

describe('toAtUri / postWebUrl', () => {
  it('builds an at:// URI', () => {
    expect(toAtUri('did:plc:xyz', '3kabc')).toBe(
      'at://did:plc:xyz/app.bsky.feed.post/3kabc',
    );
  });

  it('builds the web URL from author handle and at-uri', () => {
    expect(
      postWebUrl(
        { did: 'did:plc:xyz', handle: 'alice.test' },
        'at://did:plc:xyz/app.bsky.feed.post/3kabc',
      ),
    ).toBe('https://bsky.app/profile/alice.test/post/3kabc');
  });
});

describe('richTextToSegments', () => {
  it('returns a single segment when there are no facets', () => {
    expect(richTextToSegments('hello world')).toEqual([{ text: 'hello world' }]);
  });

  it('splits an ASCII link facet out of the surrounding text', () => {
    const text = 'see https://x.com now';
    const url = 'https://x.com';
    const byteStart = text.indexOf(url);
    const byteEnd = byteStart + url.length;
    const facets: BlueskyFacet[] = [
      {
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      },
    ];
    expect(richTextToSegments(text, facets)).toEqual([
      { text: 'see ' },
      { text: url, link: { type: 'uri', value: url } },
      { text: ' now' },
    ]);
  });

  it('uses UTF-8 byte offsets, not JS string indices (emoji safe)', () => {
    // "🏔" is 4 UTF-8 bytes but 2 UTF-16 code units; naive string slicing breaks.
    const text = 'Hi 🏔 see https://x.com';
    const url = 'https://x.com';
    const enc = new TextEncoder();
    const byteStart = enc.encode(text.slice(0, text.indexOf(url))).length;
    const byteEnd = byteStart + enc.encode(url).length;
    const facets: BlueskyFacet[] = [
      {
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      },
    ];
    const segments = richTextToSegments(text, facets);
    expect(segments[0]).toEqual({ text: 'Hi 🏔 see ' });
    expect(segments[1]).toEqual({ text: url, link: { type: 'uri', value: url } });
  });

  it('handles mention and tag features', () => {
    const text = '@bob #cool';
    const enc = new TextEncoder();
    const mentionEnd = enc.encode('@bob').length;
    const tagStart = enc.encode('@bob ').length;
    const facets: BlueskyFacet[] = [
      {
        index: { byteStart: 0, byteEnd: mentionEnd },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:bob' }],
      },
      {
        index: { byteStart: tagStart, byteEnd: enc.encode(text).length },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'cool' }],
      },
    ];
    const segments = richTextToSegments(text, facets);
    expect(segments[0].link).toEqual({ type: 'mention', value: 'did:plc:bob' });
    expect(segments[2].link).toEqual({ type: 'tag', value: 'cool' });
  });

  it('ignores overlapping/degenerate facet ranges', () => {
    const text = 'abcdef';
    const facets: BlueskyFacet[] = [
      { index: { byteStart: 0, byteEnd: 3 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'u' }] },
      { index: { byteStart: 1, byteEnd: 2 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'v' }] },
    ];
    const segments = richTextToSegments(text, facets);
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });
});

describe('segmentHref', () => {
  it('maps each link type to a URL', () => {
    expect(segmentHref({ type: 'uri', value: 'https://x.com' })).toBe('https://x.com');
    expect(segmentHref({ type: 'mention', value: 'did:plc:bob' })).toBe(
      'https://bsky.app/profile/did:plc:bob',
    );
    expect(segmentHref({ type: 'tag', value: 'cool' })).toBe(
      'https://bsky.app/hashtag/cool',
    );
  });
});

function post(uri: string, likeCount: number, indexedAt: string, replies?: ThreadNode[]): ThreadNode {
  return {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: {
      uri,
      cid: 'cid',
      author: { did: 'did:plc:a', handle: 'a.test' },
      record: { text: 't', createdAt: indexedAt },
      likeCount,
      indexedAt,
    },
    replies,
  };
}

describe('sortReplies', () => {
  const a = post('a', 1, '2024-01-01T00:00:00Z');
  const b = post('b', 5, '2024-01-02T00:00:00Z');
  const c = post('c', 5, '2024-01-03T00:00:00Z');
  const blocked: ThreadNode = { $type: 'app.bsky.feed.defs#blockedPost', uri: 'x', blocked: true };

  it('sorts by likes (then recency) in top mode', () => {
    const out = sortReplies([a, b, c], 'top');
    expect(out.map((n) => (n as { post: { uri: string } }).post.uri)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by recency in newest mode', () => {
    const out = sortReplies([a, c, b], 'newest');
    expect(out.map((n) => (n as { post: { uri: string } }).post.uri)).toEqual(['c', 'b', 'a']);
  });

  it('pushes non-post nodes to the end', () => {
    const out = sortReplies([blocked, a], 'top');
    expect(out[out.length - 1]).toBe(blocked);
  });
});

describe('isPinPost', () => {
  it('detects bare pin replies and ignores real ones', () => {
    expect(isPinPost(post('a', 0, '2024-01-01T00:00:00Z'))).toBe(false);
    const pin: ThreadNode = {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post: {
        uri: 'p',
        cid: 'c',
        author: { did: 'd', handle: 'h' },
        record: { text: ' 📌 ', createdAt: '2024-01-01T00:00:00Z' },
        indexedAt: '2024-01-01T00:00:00Z',
      },
    };
    expect(isPinPost(pin)).toBe(true);
  });
});

describe('countReplies', () => {
  it('counts nested post replies and ignores blocked/not-found', () => {
    const tree: ThreadNode[] = [
      post('a', 0, '2024-01-01T00:00:00Z', [
        post('a1', 0, '2024-01-01T00:00:00Z'),
        { $type: 'app.bsky.feed.defs#notFoundPost', uri: 'gone', notFound: true },
      ]),
      post('b', 0, '2024-01-01T00:00:00Z'),
    ];
    expect(countReplies(tree)).toBe(3);
  });
});
