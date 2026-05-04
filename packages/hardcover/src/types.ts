/**
 * Public types for the Hardcover reading-list integration.
 */

export interface HardcoverBook {
  title: string;
  slug: string;
  description: string | null;
  pages: number | null;
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

export interface ReadingListData {
  currentlyReading: UserBook[];
  wantToRead: UserBook[];
  recentlyRead: UserBook[];
  fetchedAt: string;
}
