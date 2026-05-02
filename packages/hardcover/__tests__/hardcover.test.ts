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
          user_books: [
            {
              rating: 4,
              date_added: '2025-12-01',
              book: {
                title: 'Test Book',
                slug: 'test-book',
                description: 'A great book',
                pages: 320,
                image: { url: 'https://img.hardcover.app/cover.jpg' },
                contributions: [{ author: { name: 'Jane Author' } }],
                taggings: [{ tag: { tag: 'Fiction' } }],
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
    expect(book.book.pages).toBe(320);
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
