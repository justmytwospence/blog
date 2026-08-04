/**
 * Public types for the Hardcover reading-list integration.
 */

export interface HardcoverBook {
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  authors: string[];
  hardcoverUrl: string;
  isFiction: boolean;
}

export interface UserBook {
  book: HardcoverBook;
  rating: number | null;
  dateAdded: string | null;
}

/** What it takes to link past the handful of books a shelf actually renders. */
export interface ShelfMeta {
  /**
   * Size of the whole Hardcover shelf — including books hidden here by the blocklist, since the
   * link goes to Hardcover's own page, which shows them.
   */
  total: number;
  /**
   * Public hardcover.app URL for the full shelf, or null when the account is not Public (a
   * Followers-only or Private profile would 404 for a logged-out visitor).
   */
  url: string | null;
}

export interface ReadingListData {
  currentlyReading: UserBook[];
  wantToRead: UserBook[];
  recentlyRead: UserBook[];
  /** Per-shelf totals and links, keyed to match the book arrays above. */
  shelves: {
    currentlyReading: ShelfMeta;
    wantToRead: ShelfMeta;
    recentlyRead: ShelfMeta;
  };
  fetchedAt: string;
}
