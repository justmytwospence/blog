import type { UserBook, ShelfMeta } from '@blog/hardcover/types';
import { BookCard } from '@/components/BookCard';

interface ReadingSectionProps {
  title: string;
  books: UserBook[];
  emptyMessage?: string;
  /**
   * The full Hardcover shelf behind this section. Renders a "see all" link when the shelf holds
   * more than is shown and the profile is public enough to link to.
   */
  shelf?: ShelfMeta;
}

function BookGrid({ books }: { books: UserBook[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
      {books.map((userBook) => (
        <BookCard key={userBook.book.slug} userBook={userBook} />
      ))}
    </div>
  );
}

export function ReadingSection({ title, books, emptyMessage, shelf }: ReadingSectionProps) {
  if (books.length === 0 && !emptyMessage) {
    return null;
  }

  const fiction = books.filter((ub) => ub.book.isFiction);
  const nonfiction = books.filter((ub) => !ub.book.isFiction);
  const hasBoth = fiction.length > 0 && nonfiction.length > 0;
  // Only worth a link when Hardcover actually holds more than this section shows.
  const showAllLink = shelf?.url && shelf.total > books.length;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-[#d4d4d4]">
          {title}
        </h2>
        {showAllLink && (
          <a
            href={shelf.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            All {shelf.total} on Hardcover →
          </a>
        )}
      </div>
      {books.length === 0 ? (
        <p className="text-gray-500 dark:text-[#a6a6a6]">{emptyMessage}</p>
      ) : hasBoth ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-[#a6a6a6]">Fiction</h3>
            <BookGrid books={fiction} />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-[#a6a6a6]">Non-Fiction</h3>
            <BookGrid books={nonfiction} />
          </div>
        </div>
      ) : (
        <BookGrid books={books} />
      )}
    </section>
  );
}
