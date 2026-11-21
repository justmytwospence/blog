import Link from 'next/link';
import type { UserBook } from '@blog/hardcover/types';
import { BookCard } from '@/components/BookCard';

interface RecentBooksWidgetProps {
  books: UserBook[];
}

/** Currently-reading books first, then recently finished ones, sized to fill whole grid rows. The page supplies the heading. */
export function RecentBooksWidget({ books }: RecentBooksWidgetProps) {
  if (books.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {books.map((userBook) => (
          <BookCard
            key={userBook.book.slug}
            userBook={userBook}
          />
        ))}
      </div>
      <Link
        href="/reading"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-[#a6a6a6] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        View full reading list
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
