/**
 * Hardcover API client
 *
 * Fetches reading list data from Hardcover's GraphQL API.
 *
 * Two flavours of each reader:
 *  - the default (`getReadingListData`, `getCurrentlyReading`) returns empty arrays on any failure
 *    so a build never breaks;
 *  - the `*OrThrow` variants throw on failure so the app layer can wrap them in the last-good cache
 *    (a returned `[]` looks like success to a read-through cache, so failure must be a throw).
 *
 * Auth note: Hardcover bearer tokens expire annually (Jan 1) and have no refresh mechanism, so an
 * expired token surfaces as a loud `[hardcover] AUTH FAILURE` log + a thrown `HardcoverAuthError`.
 */

import type { HardcoverBook, UserBook, ReadingListData } from './types';

export type { HardcoverBook, UserBook, ReadingListData };

/** Thrown when Hardcover rejects the token (expired/invalid), distinct from a transient failure. */
export class HardcoverAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HardcoverAuthError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

const HARDCOVER_GRAPHQL_ENDPOINT = 'https://api.hardcover.app/v1/graphql';
const FETCH_TIMEOUT_MS = 10_000;

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

/**
 * Core fetch. THROWS on failure: `HardcoverAuthError` for an expired/invalid token (logged loudly),
 * a plain `Error` for transient (HTTP/network/non-auth GraphQL) failures. A legitimately empty list
 * returns `[]` (success) — only failures throw.
 */
async function fetchUserBooksOrThrow(
  statusId: number,
  limit: number,
): Promise<UserBook[]> {
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) {
    throw new HardcoverAuthError('[hardcover] HARDCOVER_API_TOKEN is not set');
  }

  const res = await fetch(HARDCOVER_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: buildQuery(statusId, limit) }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.error(
        `[hardcover] AUTH FAILURE (${res.status}) — token likely expired. Hardcover bearer tokens ` +
          `expire annually on Jan 1 with no refresh mechanism; rotate HARDCOVER_API_TOKEN manually. ` +
          `See packages/hardcover/README.md.`,
      );
      throw new HardcoverAuthError(`[hardcover] auth failed (${res.status})`);
    }
    console.error(`[hardcover] API returned ${res.status} ${res.statusText}`);
    throw new Error(`[hardcover] API returned ${res.status}`);
  }

  const json: HardcoverResponse = await res.json();

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    // Hardcover sometimes returns auth failures as a 200 with a GraphQL error.
    if (/unauth|forbidden|token|jwt/i.test(msg)) {
      console.error(
        `[hardcover] AUTH FAILURE (GraphQL) — token likely expired: ${msg}. Rotate ` +
          `HARDCOVER_API_TOKEN manually (annual Jan 1 expiry). See packages/hardcover/README.md.`,
      );
      throw new HardcoverAuthError(`[hardcover] GraphQL auth error: ${msg}`);
    }
    console.error('[hardcover] GraphQL errors:', json.errors);
    throw new Error(`[hardcover] GraphQL errors: ${msg}`);
  }

  const userBooks = json.data?.me?.[0]?.user_books ?? [];
  const blacklist = getBlacklistedSlugs();
  return transformUserBooks(userBooks).filter(
    (ub) => !blacklist.has(ub.book.slug),
  );
}

/** Non-throwing wrapper — returns [] on any failure (the build-safe default). */
async function fetchUserBooks(
  statusId: number,
  limit: number,
): Promise<UserBook[]> {
  try {
    return await fetchUserBooksOrThrow(statusId, limit);
  } catch {
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Fetch the full reading list: currently reading, want to read, and recently read.
 * Three requests run in parallel via Promise.all. Returns empty arrays on failure.
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
 * Like `getReadingListData` but THROWS if any of the three fetches fails, so the app layer can serve
 * the last-good snapshot rather than a partially-populated list.
 */
export async function getReadingListDataOrThrow(): Promise<ReadingListData> {
  const [currentlyReading, wantToRead, recentlyRead] = await Promise.all([
    fetchUserBooksOrThrow(STATUS.CURRENTLY_READING, 10),
    fetchUserBooksOrThrow(STATUS.WANT_TO_READ, 10),
    fetchUserBooksOrThrow(STATUS.READ, 10),
  ]);

  return {
    currentlyReading,
    wantToRead,
    recentlyRead,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch only the currently-reading list (e.g. for an about-page widget). Returns [] on failure.
 */
export async function getCurrentlyReading(
  limit: number = 5,
): Promise<UserBook[]> {
  return fetchUserBooks(STATUS.CURRENTLY_READING, limit);
}

/** Like `getCurrentlyReading` but THROWS on failure (for last-good wrapping at the app layer). */
export async function getCurrentlyReadingOrThrow(
  limit: number = 5,
): Promise<UserBook[]> {
  return fetchUserBooksOrThrow(STATUS.CURRENTLY_READING, limit);
}
