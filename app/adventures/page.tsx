import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { StatsBanner } from '@/components/adventures/StatsBanner';
import { LibraryView } from '@/components/adventures/LibraryView';
import { YearlyChart } from '@/components/adventures/YearlyChart';
import { MonthlySportArea } from '@/components/adventures/MonthlySportArea';
import {
  getAllAdventures,
  getLifetimeStats,
  getYearlyTotals,
  getActivityGrandTotals,
  getLifetimeByMonthSport,
} from '@/lib/adventures';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';

export const metadata: Metadata = {
  title: 'Adventures',
  description:
    'A curated library of trail runs, mountaineering, skiing, and cycling — automated trip reports with maps, stats, and photos.',
};

export default function AdventuresPage() {
  const adventures = getAllAdventures();
  const stats = getLifetimeStats();
  const yearly = getYearlyTotals();
  const grand = getActivityGrandTotals();
  const byMonthSport = getLifetimeByMonthSport();

  return (
    <PageContainer width="wide">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">Adventures</h1>
        </div>
        <Link
          href="/adventures/objectives"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Future Objectives →
        </Link>
      </div>
      <Suspense
        fallback={<div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Loading…</div>}
      >
        <LibraryView adventures={adventures} />
      </Suspense>
      <details className="mt-12 border-t border-gray-200 pt-6 dark:border-[#303031]">
        <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]">
          Lifetime stats — {formatDistance(grand.distanceMeters)} · {formatElevation(grand.elevationGainMeters)} ·{' '}
          {formatDuration(grand.movingTimeSeconds)} all-time
        </summary>
        <div className="mt-4">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#303031] dark:bg-[#252526]">
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-[#d4d4d4]">
                {formatDistance(grand.distanceMeters)}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
                Total distance (all activities)
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#303031] dark:bg-[#252526]">
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-[#d4d4d4]">
                {formatElevation(grand.elevationGainMeters)}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
                Total vertical (all activities)
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#303031] dark:bg-[#252526]">
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-[#d4d4d4]">
                {formatDuration(grand.movingTimeSeconds)}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
                Total time (all activities)
              </div>
            </div>
          </div>
          <MonthlySportArea data={byMonthSport} />
          <YearlyChart totals={yearly} />
          <StatsBanner stats={stats} />
        </div>
      </details>
    </PageContainer>
  );
}
