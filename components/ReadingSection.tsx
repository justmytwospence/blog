import type { UserBook } from '@blog/hardcover/types';
import { BookCard } from '@/components/BookCard';

interface ReadingSectionProps {
  title: string;
  books: UserBook[];
  emptyMessage?: string;
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

export function ReadingSection({ title, books, emptyMessage }: ReadingSectionProps) {
  if (books.length === 0 && !emptyMessage) {
    return null;
  }

  const fiction = books.filter((ub) => ub.book.isFiction);
  const nonfiction = books.filter((ub) => !ub.book.isFiction);
  const hasBoth = fiction.length > 0 && nonfiction.length > 0;

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">
        {title}
      </h2>
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
