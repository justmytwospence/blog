/**
 * Tests for Hardcover API client
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Helpers ───────────────────────────────────────────────────────

/** A full mock API response for a single book */
function makeMockResponse(overrides: Record<string, any> = {}) {
  return {
    data: {
      me: [
        {
          username: 'testreader',
          account_privacy_setting_id: 1, // Public
          user_books_aggregate: { aggregate: { count: 42 } },
          lists: [{ books_count: 1, privacy_setting_id: 1, list_books: [{ book_id: 1 }] }],
          user_books: [
            {
              book_id: 1,
              rating: 4,
              date_added: '2025-12-01',
              book: {
                title: 'Test Book',
                subtitle: null,
                slug: 'test-book',
                description: 'A great book',
                image: { url: 'https://img.hardcover.app/cover.jpg' },
                contributions: [{ author: { name: 'Jane Author' } }],
                literary_type_id: 1,
                book_category_id: 1,
                cached_tags: { Genre: [{ tag: 'Fiction' }] },
                ...overrides,
              },
            },
          ],
        },
      ],
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('hardcover API client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns empty arrays when HARDCOVER_API_TOKEN is not set', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', '');

    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.currentlyReading).toEqual([]);
    expect(data.wantToRead).toEqual([]);
    expect(data.recentlyRead).toEqual([]);
    expect(data.shelves.recentlyRead).toEqual({ total: 0, url: null });
    expect(data.fetchedAt).toBeTruthy();
  });

  it('returns empty arrays when API returns error status', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toEqual([]);
  });

  it('returns empty arrays when fetch throws a network error', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toEqual([]);
  });

  it('returns empty arrays when GraphQL returns errors', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Unauthorized' }],
      }),
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toEqual([]);
  });

  it('correctly transforms a valid API response', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeMockResponse(),
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toHaveLength(1);

    const book = books[0];
    expect(book.rating).toBe(4);
    expect(book.dateAdded).toBe('2025-12-01');
    expect(book.book.title).toBe('Test Book');
    expect(book.book.slug).toBe('test-book');
    expect(book.book.description).toBe('A great book');
    expect(book.book.imageUrl).toBe('https://img.hardcover.app/cover.jpg');
    expect(book.book.authors).toEqual(['Jane Author']);
    expect(book.book.hardcoverUrl).toBe(
      'https://hardcover.app/books/test-book',
    );
  });

  it('handles books with no cover image', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeMockResponse({ image: null }),
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toHaveLength(1);
    expect(books[0].book.imageUrl).toBeNull();
  });

  it('handles books with no authors (empty contributions)', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeMockResponse({ contributions: [] }),
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toHaveLength(1);
    expect(books[0].book.authors).toEqual([]);
  });

  it('filters out books whose title contains a blocked keyword (case-insensitive)', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          me: [
            {
              username: 'testreader',
              account_privacy_setting_id: 1,
              user_books_aggregate: { aggregate: { count: 2 } },
              user_books: [
                {
                  rating: 5,
                  date_added: '2025-12-02',
                  book: {
                    title: 'The Suicide Index',
                    subtitle: null,
                    slug: 'the-suicide-index',
                    description: null,
                    image: null,
                    contributions: [],
                    literary_type_id: null,
                    book_category_id: 1,
                    cached_tags: null,
                  },
                },
                {
                  rating: 4,
                  date_added: '2025-12-01',
                  book: {
                    title: 'A Normal Book',
                    subtitle: null,
                    slug: 'a-normal-book',
                    description: null,
                    image: null,
                    contributions: [],
                    literary_type_id: null,
                    book_category_id: 1,
                    cached_tags: null,
                  },
                },
              ],
            },
          ],
        },
      }),
    });

    const { getCurrentlyReading } = await import('../src');
    const books = await getCurrentlyReading();

    expect(books).toHaveLength(1);
    expect(books[0].book.slug).toBe('a-normal-book');
  });

  it('blocks title keywords by stem, not whole word', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      // "Suicidal" does not contain "suicide" — the keyword has to match the stem.
      json: async () => makeMockResponse({ title: 'The Suicidal Mind', slug: 'the-suicidal-mind' }),
    });

    const { getCurrentlyReading } = await import('../src');
    expect(await getCurrentlyReading()).toEqual([]);
  });

  it('blocks on the slug when the title is a truncated form', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      // Real record: Hardcover stores the title without the telling half of it.
      json: async () =>
        makeMockResponse({ title: 'The savage god', slug: 'the-savage-god-a-study-of-suicide' }),
    });

    const { getCurrentlyReading } = await import('../src');
    expect(await getCurrentlyReading()).toEqual([]);
  });

  it('does not block on the description alone', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        makeMockResponse({
          title: "It's Kind of a Funny Story",
          slug: 'its-kind-of-a-funny-story',
          description: 'A teenager checks himself into a psychiatric ward after suicidal thoughts.',
        }),
    });

    const { getCurrentlyReading } = await import('../src');
    expect(await getCurrentlyReading()).toHaveLength(1);
  });

  it('getReadingListData runs three fetches in parallel', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeMockResponse(),
    });
    globalThis.fetch = mockFetch;

    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    // Three parallel requests: currently reading, want to read, read
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(data.currentlyReading).toHaveLength(1);
    expect(data.wantToRead).toHaveLength(1);
    expect(data.recentlyRead).toHaveLength(1);
    expect(data.fetchedAt).toBeTruthy();
  });
});

describe('hardcover shelf limits and links', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  /** The `order_by` sort keys of a query, list order preserved. */
  function sortKeys(query: string): string[] {
    const inner = query.match(/order_by:\s*\[([^\]]*)\]/)![1];
    return [...inner.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].trim());
  }

  const leadingSortKey = (query: string) => sortKeys(query)[0];

  /** The three parallel shelf queries, keyed by which shelf each one asked for. */
  function queriesByStatus(mockFetch: ReturnType<typeof vi.fn>) {
    const queries: string[] = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body).query);
    return {
      currentlyReading: queries.find((q) => q.includes('_eq: 2'))!,
      recentlyRead: queries.find((q) => q.includes('_eq: 3'))!,
    };
  }

  /**
   * A shelf of `count` books alternating fiction / non-fiction every `fictionRun` books, so a test
   * can control how deep the classifier has to read to fill a group.
   */
  function makeShelf(
    count: number,
    {
      privacyId = 1 as number | null,
      total = 99,
      fictionRun = 1,
      listPrivacyId = 1,
      listOrder = undefined as number[] | undefined,
    } = {},
  ) {
    return {
      data: {
        me: [
          {
            username: 'testreader',
            account_privacy_setting_id: privacyId,
            user_books_aggregate: { aggregate: { count: total } },
            // The ranked TBR list: same books, in `listOrder` (default: shelf order).
            lists: [
              {
                books_count: total,
                privacy_setting_id: listPrivacyId,
                list_books: (listOrder ?? Array.from({ length: count }, (_, i) => i)).map((i) => ({
                  book_id: 1000 + i,
                })),
              },
            ],
            user_books: Array.from({ length: count }, (_, i) => ({
              book_id: 1000 + i,
              rating: null,
              date_added: '2025-12-01',
              book: {
                title: `Book ${i}`,
                subtitle: null,
                slug: `book-${i}`,
                description: null,
                image: null,
                contributions: [],
                // literary_type_id 1 = fiction, 2 = non-fiction
                literary_type_id: i % (fictionRun + 1) === fictionRun ? 2 : 1,
                book_category_id: 1,
                cached_tags: null,
              },
            })),
          },
        ],
      },
    };
  }

  it('caps each fiction/non-fiction group at GROUP_LIMIT, not the shelf as a whole', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(40) });

    const { getReadingListData, GROUP_LIMIT } = await import('../src');
    const data = await getReadingListData();

    expect(GROUP_LIMIT).toBe(6);
    for (const shelf of [data.wantToRead, data.recentlyRead]) {
      expect(shelf.filter((ub) => ub.book.isFiction)).toHaveLength(GROUP_LIMIT);
      expect(shelf.filter((ub) => !ub.book.isFiction)).toHaveLength(GROUP_LIMIT);
      expect(shelf).toHaveLength(GROUP_LIMIT * 2);
    }
  });

  it('reads deep enough to fill the minority group on a lopsided shelf', async () => {
    // 9:1 fiction — the real "Read" shelf's ratio. The 6th non-fiction book sits ~27 deep.
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => makeShelf(40, { fictionRun: 9 }) });

    const { getReadingListData, GROUP_LIMIT } = await import('../src');
    const data = await getReadingListData();

    expect(data.recentlyRead.filter((ub) => ub.book.isFiction)).toHaveLength(GROUP_LIMIT);
    expect(data.recentlyRead.filter((ub) => !ub.book.isFiction)).toHaveLength(4); // all that exist
  });

  it('leaves Currently Reading uncapped', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(23) });

    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.currentlyReading).toHaveLength(23);
  });

  it('preserves shelf order within each group', async () => {
    vi.stubEnv('HARDCOVER_BLACKLIST', 'book-0,book-2');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(40) });

    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    const slugs = data.wantToRead.map((ub) => ub.book.slug);
    expect(slugs).not.toContain('book-0');
    expect(slugs).not.toContain('book-2');
    // Still ascending — trimming must not reorder the shelf.
    const indices = slugs.map((s) => Number(s.split('-')[1]));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('sends no limit for Currently Reading and a window for the others', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(40) });
    globalThis.fetch = mockFetch;

    const { getReadingListData } = await import('../src');
    await getReadingListData();

    const queries = queriesByStatus(mockFetch);

    expect(queries.currentlyReading).not.toMatch(/limit:/);
    expect(queries.recentlyRead).toMatch(/limit:\s*40/);
  });

  it('sorts every shelf newest-first on the date its heading refers to', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(40) });
    globalThis.fetch = mockFetch;

    const { getReadingListData } = await import('../src');
    await getReadingListData();

    const queries = queriesByStatus(mockFetch);

    // "Currently Reading" means most recently *touched*. `date_added` is when the book entered the
    // library, often months before it was opened, so it must not be the leading key.
    expect(leadingSortKey(queries.currentlyReading)).toBe('updated_at: desc');
    // "Recently Read" means recently *finished*, not recently shelved.
    expect(leadingSortKey(queries.recentlyRead)).toBe('last_read_date: desc_nulls_last');
  });

  it('breaks same-day ties deterministically on every shelf', async () => {
    // `date_added` / `last_read_date` are `date` columns: without a tiebreak Postgres is free to
    // return same-day books in a different order each fetch, reshuffling the row and potentially
    // bumping a newer book out of the trimmed grid.
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeShelf(40) });
    globalThis.fetch = mockFetch;

    const { getReadingListData } = await import('../src');
    await getReadingListData();

    for (const query of Object.values(queriesByStatus(mockFetch))) {
      const keys = sortKeys(query);
      expect(keys.length).toBeGreaterThan(1);
      // A unique, monotonic last key is what makes the ordering total.
      expect(keys.at(-1)).toBe('id: desc');
    }
  });

  it('links to the public Hardcover shelf, with the full shelf total', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => makeShelf(15, { total: 292 }) });

    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.shelves.wantToRead).toEqual({
      total: 292,
      url: 'https://hardcover.app/@testreader/lists/shortlist',
    });
    expect(data.shelves.recentlyRead.url).toBe('https://hardcover.app/@testreader/books/read');
    expect(data.shelves.currentlyReading.url).toBe(
      'https://hardcover.app/@testreader/books/currently-reading',
    );
  });

  it('omits shelf links when the account is not public', async () => {
    // 2 = Followers only, 3 = Private — either would 404 for a logged-out visitor.
    for (const privacyId of [2, 3, null]) {
      vi.resetModules();
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => makeShelf(15, { privacyId }) });

      const { getReadingListData } = await import('../src');
      const data = await getReadingListData();

      expect(data.shelves.wantToRead.url).toBeNull();
      // The total is still reported; only the link is withheld.
      expect(data.shelves.wantToRead.total).toBe(99);
    }
  });
});

describe('hardcover TBR shortlist', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function userBook(id: number, fiction = true) {
    return {
      book_id: id,
      rating: null,
      date_added: '2025-12-01',
      book: {
        title: `Book ${id}`,
        subtitle: null,
        slug: `book-${id}`,
        description: null,
        image: null,
        contributions: [],
        literary_type_id: fiction ? 1 : 2,
        book_category_id: 1,
        cached_tags: null,
      },
    };
  }

  /** Mock that answers the shortlist query with `listIds` in rank order and `tbr` as Want to Read. */
  function mockShortlist(
    listIds: number[] | null,
    tbr: ReturnType<typeof userBook>[],
    { listPrivacyId = 1 } = {},
  ) {
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body);
      const isList = query.includes('lists(');
      return {
        ok: true,
        json: async () => ({
          data: {
            me: [
              {
                username: 'testreader',
                account_privacy_setting_id: 1,
                user_books_aggregate: { aggregate: { count: 0 } },
                lists:
                  isList && listIds
                    ? [
                        {
                          books_count: listIds.length,
                          privacy_setting_id: listPrivacyId,
                          list_books: listIds.map((book_id) => ({ book_id })),
                        },
                      ]
                    : [],
                user_books: isList ? tbr : [],
              },
            ],
          },
        }),
      };
    });
    globalThis.fetch = mockFetch;
    return mockFetch;
  }

  it('queries Want to Read books on the shortlist, ranked by list position', async () => {
    const mockFetch = mockShortlist([1], [userBook(1)]);
    const { getReadingListData } = await import('../src');
    await getReadingListData();

    const query: string = mockFetch.mock.calls
      .map((c) => JSON.parse(c[1].body).query)
      .find((q: string) => q.includes('lists('));
    expect(query).toMatch(/slug:\s*\{\s*_eq:\s*"shortlist"/);
    expect(query).toMatch(/order_by:\s*\[\{\s*position:\s*asc\s*\}/);
    expect(query).toMatch(/status_id:\s*\{\s*_eq:\s*1\s*\}/);
  });

  it('orders books by their list rank, not the order Hardcover returns them', async () => {
    mockShortlist([3, 1, 2], [userBook(1), userBook(2), userBook(3)]);
    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.wantToRead.map((ub) => ub.book.slug)).toEqual(['book-3', 'book-1', 'book-2']);
  });

  it('drops list books that are no longer Want to Read, and other users\' list matches', async () => {
    // 2 is on the list but already started (absent from Want to Read); 9 is Want to Read and on
    // someone else's "shortlist" (absent from my list).
    mockShortlist([1, 2, 3], [userBook(1), userBook(3), userBook(9)]);
    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.wantToRead.map((ub) => ub.book.slug)).toEqual(['book-1', 'book-3']);
  });

  it('caps each fiction/non-fiction group in rank order', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    mockShortlist(ids, ids.map((id) => userBook(id, id % 2 === 0)));
    const { getReadingListData, GROUP_LIMIT } = await import('../src');
    const data = await getReadingListData();

    const fiction = data.wantToRead.filter((ub) => ub.book.isFiction).map((ub) => ub.book.slug);
    expect(fiction).toHaveLength(GROUP_LIMIT);
    expect(fiction[0]).toBe('book-2');
    expect(data.wantToRead.filter((ub) => !ub.book.isFiction)).toHaveLength(GROUP_LIMIT);
  });

  it('throws when the list is missing, so the last-good TBR is served', async () => {
    mockShortlist(null, [userBook(1)]);
    const { getReadingListDataOrThrow, getReadingListData } = await import('../src');

    await expect(getReadingListDataOrThrow()).rejects.toThrow(/shortlist/);
    expect((await getReadingListData()).wantToRead).toEqual([]);
  });

  it('withholds the link when the list itself is not public', async () => {
    mockShortlist([1], [userBook(1)], { listPrivacyId: 3 });
    const { getReadingListData } = await import('../src');
    const data = await getReadingListData();

    expect(data.shelves.wantToRead).toEqual({ total: 1, url: null });
  });
});

describe('hardcover throwing variants (for last-good wrapping)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('rejects with HardcoverAuthError when the token is not set', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', '');
    const { getCurrentlyReadingOrThrow, HardcoverAuthError } = await import('../src');
    await expect(getCurrentlyReadingOrThrow()).rejects.toBeInstanceOf(HardcoverAuthError);
  });

  it('rejects with HardcoverAuthError on a 401', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
    const { getCurrentlyReadingOrThrow, HardcoverAuthError } = await import('../src');
    await expect(getCurrentlyReadingOrThrow()).rejects.toBeInstanceOf(HardcoverAuthError);
  });

  it('rejects with HardcoverAuthError on a GraphQL auth error (200 body)', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
    });
    const { getCurrentlyReadingOrThrow, HardcoverAuthError } = await import('../src');
    await expect(getCurrentlyReadingOrThrow()).rejects.toBeInstanceOf(HardcoverAuthError);
  });

  it('rejects (transient Error, not auth) on a 500', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const { getCurrentlyReadingOrThrow, HardcoverAuthError } = await import('../src');
    await expect(getCurrentlyReadingOrThrow()).rejects.toThrow();
    await expect(getCurrentlyReadingOrThrow()).rejects.not.toBeInstanceOf(HardcoverAuthError);
  });

  it('rejects when fetch throws a network error', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { getCurrentlyReadingOrThrow } = await import('../src');
    await expect(getCurrentlyReadingOrThrow()).rejects.toThrow('Network error');
  });

  it('resolves with books on the happy path', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => makeMockResponse() });
    const { getReadingListDataOrThrow } = await import('../src');
    const data = await getReadingListDataOrThrow();
    expect(data.currentlyReading).toHaveLength(1);
    expect(data.fetchedAt).toBeTruthy();
  });
});

describe('getRecentBooksOrThrow', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  /** Mock one shelf per status id, each holding books with the given slugs. */
  function mockShelves(shelves: Record<number, string[]>) {
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body) as { query: string };
      const statusId = Number(/status_id: \{ _eq: (\d+) \}/.exec(query)![1]);
      const response = makeMockResponse();
      const template = response.data.me[0].user_books[0];
      response.data.me[0].user_books = (shelves[statusId] ?? []).map((slug) => ({
        ...template,
        book: { ...template.book, slug, title: slug },
      }));
      return { ok: true, json: async () => response };
    });
  }

  it('puts currently reading first and fills the rest with recently read', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    mockShelves({ 2: ['cur-1', 'cur-2'], 3: ['read-1', 'read-2', 'read-3', 'read-4', 'read-5'] });
    const { getRecentBooksOrThrow } = await import('../src');
    const books = await getRecentBooksOrThrow(6);
    expect(books.map((ub) => ub.book.slug)).toEqual([
      'cur-1',
      'cur-2',
      'read-1',
      'read-2',
      'read-3',
      'read-4',
    ]);
  });

  it('caps at the limit and dedupes a book on both shelves', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    mockShelves({ 2: ['a', 'b'], 3: ['b', 'c', 'd'] });
    const { getRecentBooksOrThrow } = await import('../src');
    const books = await getRecentBooksOrThrow(3);
    expect(books.map((ub) => ub.book.slug)).toEqual(['a', 'b', 'c']);
  });

  it('rejects when either shelf fails', async () => {
    vi.stubEnv('HARDCOVER_API_TOKEN', 'test-token');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const { getRecentBooksOrThrow } = await import('../src');
    await expect(getRecentBooksOrThrow(6)).rejects.toThrow();
  });
});
