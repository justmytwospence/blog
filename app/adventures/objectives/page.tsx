import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { ObjectivesView } from '@/components/adventures/ObjectivesView';
import { getObjectives, getObjectiveLists } from '@/lib/adventures';

export const metadata: Metadata = {
  title: 'Future Objectives',
  description: 'Routes, peaks, traverses, and trips still on the list.',
};

export default function ObjectivesPage() {
  const { objectives } = getObjectives();
  const lists = getObjectiveLists();

  return (
    <PageContainer width="wide">
      <Link
        href="/adventures"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
      >
        ← Adventures
      </Link>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">Future Objectives</h1>
        <p className="mt-2 text-gray-600 dark:text-[#cccccc]">
          Routes, peaks, and trips still on the list — the forward-looking half of the logbook.
        </p>
      </div>
      {objectives.length > 0 || lists.length > 0 ? (
        <Suspense
          fallback={<div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Loading…</div>}
        >
          <ObjectivesView objectives={objectives} lists={lists} />
        </Suspense>
      ) : (
        <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Nothing on the list yet.</div>
      )}
    </PageContainer>
  );
}
