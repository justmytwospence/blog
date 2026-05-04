/**
 * Hardcover API client
 *
 * Fetches reading list data from Hardcover's GraphQL API.
 * All public functions return empty arrays on failure so the build never breaks.
 */

import type { HardcoverBook, UserBook, ReadingListData } from './types';

export type { HardcoverBook, UserBook, ReadingListData };

// ─── Constants ─────────────────────────────────────────────────────

const HARDCOVER_GRAPHQL_ENDPOINT = 'https://api.hardcover.app/v1/graphql';

/** Book slugs to exclude from the public reading list (comma-separated in HARDCOVER_BLACKLIST env var) */
function getBlacklistedSlugs(): Set<string> {
  const raw = process.env.HARDCOVER_BLACKLIST ?? '';
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

/** Hardcover status IDs */
const STATUS = {
  WANT_TO_READ: 1,
  CURRENTLY_READING: 2,
  READ: 3,
  DID_NOT_FINISH: 5,
} as const;

// ─── Raw API types (internal) ──────────────────────────────────────

interface RawContribution {
  author: { name: string };
}

interface RawTagging {
  tag: { tag: string };
}

interface RawBook {
  title: string;
  slug: string;
  description: string | null;
  pages: number | null;
  image: { url: string } | null;
  contributions: RawContribution[];
  taggings: RawTagging[];
}

interface RawUserBook {
  rating: number | null;
  date_added: string | null;
  book: RawBook;
}

interface HardcoverResponse {
  data?: {
    me?: Array<{
      user_books: RawUserBook[];
    }>;
  };
  errors?: Array<{ message: string }>;
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildQuery(statusId: number, limit: number): string {
  return `{
  me {
    user_books(
      where: { status_id: { _eq: ${statusId} } }
      order_by: { date_added: desc }
      limit: ${limit}
    ) {
      rating
      date_added
      book {
        title
        slug
        description
        pages
        image { url }
        contributions { author { name } }
        taggings(where: {tag: {tag: {_in: ["Fiction", "Nonfiction"]}}}) { tag { tag } }
      }
    }
  }
}`;
}

function computeIsFiction(taggings: RawTagging[]): boolean {
  let fiction = 0;
  let nonfiction = 0;
  for (const t of taggings) {
    if (t.tag.tag === 'Fiction') fiction++;
    else if (t.tag.tag === 'Nonfiction') nonfiction++;
  }
  // Default to fiction when no tags present
  return nonfiction === 0 || fiction >= nonfiction;
}

function transformBook(raw: RawBook): HardcoverBook {
  return {
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    pages: raw.pages,
    imageUrl: raw.image?.url ?? null,
    authors: raw.contributions.map((c) => c.author.name),
    hardcoverUrl: `https://hardcover.app/books/${raw.slug}`,
    isFiction: computeIsFiction(raw.taggings),
  };
}

function transformUserBooks(rawBooks: RawUserBook[]): UserBook[] {
  return rawBooks.map((rb) => ({
    book: transformBook(rb.book),
    rating: rb.rating,
    dateAdded: rb.date_added,
  }));
}

async function fetchUserBooks(
  statusId: number,
  limit: number,
): Promise<UserBook[]> {
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) {
    console.warn('[hardcover] HARDCOVER_API_TOKEN is not set — skipping fetch');
    return [];
  }

  try {
    const res = await fetch(HARDCOVER_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: buildQuery(statusId, limit) }),
    });

    if (!res.ok) {
      console.error(
        `[hardcover] API returned ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const json: HardcoverResponse = await res.json();

    if (json.errors?.length) {
      console.error('[hardcover] GraphQL errors:', json.errors);
      return [];
    }

    const userBooks = json.data?.me?.[0]?.user_books ?? [];
    const blacklist = getBlacklistedSlugs();
    return transformUserBooks(userBooks).filter(
      (ub) => !blacklist.has(ub.book.slug),
    );
  } catch (err) {
    console.error('[hardcover] Fetch failed:', err);
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Fetch the full reading list: currently reading, want to read, and recently read.
 * Three requests run in parallel via Promise.all.
 */
export async function getReadingListData(): Promise<ReadingListData> {
  const [currentlyReading, wantToRead, recentlyRead] = await Promise.all([
    fetchUserBooks(STATUS.CURRENTLY_READING, 10),
    fetchUserBooks(STATUS.WANT_TO_READ, 10),
    fetchUserBooks(STATUS.READ, 10),
  ]);

  return {
    currentlyReading,
    wantToRead,
    recentlyRead,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch only the currently-reading list (e.g. for an about-page widget).
 */
export async function getCurrentlyReading(
  limit: number = 5,
): Promise<UserBook[]> {
  return fetchUserBooks(STATUS.CURRENTLY_READING, limit);
}
