import { getReadingListDataOrThrow, type ReadingListData } from '@blog/hardcover';
import { ReadingSection } from '@/components/ReadingSection';
import { PageContainer } from '@/components/PageContainer';
import { readThrough } from '@/lib/last-good';
import type { Metadata } from 'next';

// Renders via ISR (hourly) — do not opt this route into dynamic rendering or it will hit Hardcover
// per-request. readThrough serves the last-good snapshot if Hardcover is down at revalidation.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Reading',
  description: 'Books I am reading, want to read, and have recently read.',
};

const EMPTY_READING: ReadingListData = {
  currentlyReading: [],
  wantToRead: [],
  recentlyRead: [],
  fetchedAt: new Date().toISOString(),
};

export default async function ReadingPage() {
  const { currentlyReading, wantToRead, recentlyRead, fetchedAt } =
    (await readThrough<ReadingListData>('hardcover:reading-list', getReadingListDataOrThrow).catch(
      () => null,
    )) ?? EMPTY_READING;
  const hasAnyBooks = currentlyReading.length > 0 || wantToRead.length > 0 || recentlyRead.length > 0;

  return (
    <PageContainer width="wide">
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
    </PageContainer>
  );
}
