import { getReadingListData } from '@/lib/hardcover';
import { ReadingSection } from '@/components/ReadingSection';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Reading',
  description: 'Books I am reading, want to read, and have recently read.',
};

export default async function ReadingPage() {
  const { currentlyReading, wantToRead, recentlyRead, fetchedAt } = await getReadingListData();
  const hasAnyBooks = currentlyReading.length > 0 || wantToRead.length > 0 || recentlyRead.length > 0;

  return (
    <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-2 sm:py-8 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-[#d4d4d4]">Reading</h1>
      </div>

      {hasAnyBooks ? (
        <div className="space-y-12">
          <ReadingSection title="Currently Reading" books={currentlyReading}
            emptyMessage="Nothing on the nightstand right now." />
          <ReadingSection title="Recently Read" books={recentlyRead} />
          <ReadingSection title="To Be Read" books={wantToRead} />
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-[#a6a6a6]">Reading list data is not available right now. Check back soon!</p>
        </div>
      )}

      {hasAnyBooks && (
        <p className="text-xs text-gray-400 dark:text-[#6b6b6b] mt-8">
          Last updated: {new Date(fetchedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}
    </main>
  );
}
