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

import type { HardcoverBook, UserBook, ReadingListData, ShelfMeta } from './types';
import { classifyIsFiction, type CachedTags } from './classify';

export type { HardcoverBook, UserBook, ReadingListData, ShelfMeta };
export { classifyIsFiction } from './classify';

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

/**
 * Title substrings (case-insensitive) that exclude a book from the public reading list, regardless
 * of slug. Unlike the slug blacklist this is an open-ended keyword rule, so it also hides future
 * books whose slug we don't know yet.
 */
const TITLE_BLOCKLIST = ['suicide'];

function isTitleBlocked(title: string): boolean {
  const t = title.toLowerCase();
  return TITLE_BLOCKLIST.some((kw) => t.includes(kw));
}

/** Hardcover status IDs */
const STATUS = {
  WANT_TO_READ: 1,
  CURRENTLY_READING: 2,
  READ: 3,
  DID_NOT_FINISH: 5,
} as const;

/** `account_privacy_setting_id` 1 = Public; 2 = Followers only; 3 = Private. */
const PRIVACY_PUBLIC = 1;

/** How many books each shelf shows on the site. Uniform, so no section looks arbitrarily longer. */
export const SHELF_LIMIT = 5;

/**
 * The blocklist drops books *after* the query runs, so asking Hardcover for exactly `SHELF_LIMIT`
 * would render a short row whenever a blocked book lands inside the window. Over-fetch by this much
 * and trim back to the requested count.
 */
const BLOCKLIST_PAD = 10;

/**
 * Per-shelf query shape. `orderBy` is what makes each section mean what its heading claims:
 * "Recently Read" must sort by when a book was *finished* (`last_read_date`), not when it was added
 * — books are routinely shelved months before they are finished, so `date_added` silently omits
 * recent finishes. The other two shelves genuinely are "most recently added".
 */
const SHELVES = {
  currentlyReading: {
    statusId: STATUS.CURRENTLY_READING,
    orderBy: '{ date_added: desc }',
    path: 'currently-reading',
  },
  recentlyRead: {
    statusId: STATUS.READ,
    orderBy: '{ last_read_date: desc_nulls_last }',
    path: 'read',
  },
  wantToRead: {
    statusId: STATUS.WANT_TO_READ,
    orderBy: '{ date_added: desc }',
    path: 'want-to-read',
  },
} as const;

type ShelfKey = keyof typeof SHELVES;

/** Public shelf URL on hardcover.app, e.g. `https://hardcover.app/@user/books/read`. */
function shelfUrl(username: string, path: string): string {
  return `https://hardcover.app/@${username}/books/${path}`;
}

// ─── Raw API types (internal) ──────────────────────────────────────

interface RawContribution {
  author: { name: string };
}

interface RawBook {
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  image: { url: string } | null;
  contributions: RawContribution[];
  literary_type_id: number | null;
  book_category_id: number | null;
  cached_tags: CachedTags;
}

interface RawUserBook {
  rating: number | null;
  date_added: string | null;
  book: RawBook;
}

interface HardcoverResponse {
  data?: {
    me?: Array<{
      username?: string | null;
      account_privacy_setting_id?: number | null;
      user_books_aggregate?: { aggregate?: { count?: number | null } | null } | null;
      user_books: RawUserBook[];
    }>;
  };
  errors?: Array<{ message: string }>;
}

/** One shelf as read from Hardcover: the trimmed books plus what it takes to link to the rest. */
interface RawShelf {
  books: UserBook[];
  /** Size of the whole Hardcover shelf, before the local blocklist and the display limit. */
  total: number;
  username: string | null;
  isPublic: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * One request per shelf. `username` / `account_privacy_setting_id` ride along so the caller can
 * build shelf links without a second round trip, and `user_books_aggregate` gives the full shelf
 * size for the "see all N" affordance.
 */
function buildQuery(statusId: number, orderBy: string, limit: number): string {
  return `{
  me {
    username
    account_privacy_setting_id
    user_books_aggregate(where: { status_id: { _eq: ${statusId} } }) {
      aggregate { count }
    }
    user_books(
      where: { status_id: { _eq: ${statusId} } }
      order_by: ${orderBy}
      limit: ${limit}
    ) {
      rating
      date_added
      book {
        title
        subtitle
        slug
        description
        image { url }
        contributions { author { name } }
        literary_type_id
        book_category_id
        cached_tags
      }
    }
  }
}`;
}

function transformBook(raw: RawBook): HardcoverBook {
  return {
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    imageUrl: raw.image?.url ?? null,
    authors: raw.contributions.map((c) => c.author.name),
    hardcoverUrl: `https://hardcover.app/books/${raw.slug}`,
    isFiction: classifyIsFiction({
      literaryTypeId: raw.literary_type_id,
      bookCategoryId: raw.book_category_id,
      cachedTags: raw.cached_tags,
      title: raw.title,
      subtitle: raw.subtitle,
    }),
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
async function fetchShelfOrThrow(
  statusId: number,
  orderBy: string,
  limit: number,
): Promise<RawShelf> {
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
    body: JSON.stringify({ query: buildQuery(statusId, orderBy, limit + BLOCKLIST_PAD) }),
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

  const me = json.data?.me?.[0];
  const blacklist = getBlacklistedSlugs();
  const books = transformUserBooks(me?.user_books ?? [])
    .filter((ub) => !blacklist.has(ub.book.slug) && !isTitleBlocked(ub.book.title))
    .slice(0, limit); // trim the over-fetch back to the display limit

  return {
    books,
    total: me?.user_books_aggregate?.aggregate?.count ?? 0,
    username: me?.username ?? null,
    isPublic: me?.account_privacy_setting_id === PRIVACY_PUBLIC,
  };
}

/** Non-throwing wrapper — returns an empty shelf on any failure (the build-safe default). */
async function fetchShelf(
  statusId: number,
  orderBy: string,
  limit: number,
): Promise<RawShelf> {
  try {
    return await fetchShelfOrThrow(statusId, orderBy, limit);
  } catch {
    return { books: [], total: 0, username: null, isPublic: false };
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Assemble the three fetched shelves into the public payload.
 *
 * Shelf links are emitted only when the Hardcover account is Public — on a Followers-only or Private
 * account the URLs would 404 for a logged-out visitor, so `url` goes null and the UI drops the
 * "see all" affordance rather than linking somewhere unreadable.
 */
function toReadingListData(shelves: Record<ShelfKey, RawShelf>): ReadingListData {
  const username = shelves.currentlyReading.username;
  const isPublic = shelves.currentlyReading.isPublic;

  const meta = (key: ShelfKey) => ({
    total: shelves[key].total,
    url: isPublic && username ? shelfUrl(username, SHELVES[key].path) : null,
  });

  return {
    currentlyReading: shelves.currentlyReading.books,
    wantToRead: shelves.wantToRead.books,
    recentlyRead: shelves.recentlyRead.books,
    shelves: {
      currentlyReading: meta('currentlyReading'),
      recentlyRead: meta('recentlyRead'),
      wantToRead: meta('wantToRead'),
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch the full reading list: currently reading, want to read, and recently read — `SHELF_LIMIT`
 * books each. Three requests run in parallel via Promise.all. Returns empty shelves on failure.
 */
export async function getReadingListData(): Promise<ReadingListData> {
  const [currentlyReading, recentlyRead, wantToRead] = await Promise.all([
    fetchShelf(SHELVES.currentlyReading.statusId, SHELVES.currentlyReading.orderBy, SHELF_LIMIT),
    fetchShelf(SHELVES.recentlyRead.statusId, SHELVES.recentlyRead.orderBy, SHELF_LIMIT),
    fetchShelf(SHELVES.wantToRead.statusId, SHELVES.wantToRead.orderBy, SHELF_LIMIT),
  ]);

  return toReadingListData({ currentlyReading, recentlyRead, wantToRead });
}

/**
 * Like `getReadingListData` but THROWS if any of the three fetches fails, so the app layer can serve
 * the last-good snapshot rather than a partially-populated list.
 */
export async function getReadingListDataOrThrow(): Promise<ReadingListData> {
  const [currentlyReading, recentlyRead, wantToRead] = await Promise.all([
    fetchShelfOrThrow(
      SHELVES.currentlyReading.statusId,
      SHELVES.currentlyReading.orderBy,
      SHELF_LIMIT,
    ),
    fetchShelfOrThrow(SHELVES.recentlyRead.statusId, SHELVES.recentlyRead.orderBy, SHELF_LIMIT),
    fetchShelfOrThrow(SHELVES.wantToRead.statusId, SHELVES.wantToRead.orderBy, SHELF_LIMIT),
  ]);

  return toReadingListData({ currentlyReading, recentlyRead, wantToRead });
}

/**
 * Fetch only the currently-reading list (e.g. for an about-page widget). Returns [] on failure.
 */
export async function getCurrentlyReading(
  limit: number = SHELF_LIMIT,
): Promise<UserBook[]> {
  const shelf = await fetchShelf(
    SHELVES.currentlyReading.statusId,
    SHELVES.currentlyReading.orderBy,
    limit,
  );
  return shelf.books;
}

/** Like `getCurrentlyReading` but THROWS on failure (for last-good wrapping at the app layer). */
export async function getCurrentlyReadingOrThrow(
  limit: number = SHELF_LIMIT,
): Promise<UserBook[]> {
  const shelf = await fetchShelfOrThrow(
    SHELVES.currentlyReading.statusId,
    SHELVES.currentlyReading.orderBy,
    limit,
  );
  return shelf.books;
}
