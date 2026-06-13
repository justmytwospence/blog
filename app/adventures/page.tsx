import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { StatsBanner } from '@/components/adventures/StatsBanner';
import { LibraryView } from '@/components/adventures/LibraryView';
import { YearlyChart } from '@/components/adventures/YearlyChart';
import { getAllAdventures, getLifetimeStats, getYearlyTotals } from '@/lib/adventures';

export const metadata: Metadata = {
  title: 'Adventures',
  description:
    'A curated library of trail runs, mountaineering, skiing, and cycling — automated trip reports with maps, stats, and photos.',
};

export default function AdventuresPage() {
  const adventures = getAllAdventures();
  const stats = getLifetimeStats();
  const yearly = getYearlyTotals();

  return (
    <PageContainer width="wide">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">Adventures</h1>
          <p className="mt-2 text-gray-600 dark:text-[#cccccc]">
            A curated log of long days out — runs, climbs, skis, and rides worth remembering.
          </p>
        </div>
        <Link
          href="/adventures/objectives"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Future Objectives →
        </Link>
      </div>
      <StatsBanner stats={stats} />
      <YearlyChart totals={yearly} />
      <Suspense
        fallback={<div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Loading…</div>}
      >
        <LibraryView adventures={adventures} />
      </Suspense>
    </PageContainer>
  );
}
