import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { CatalogMap } from '@/components/adventures/objectives/CatalogMap';
import { getObjectiveCatalog } from '@/lib/adventures';
import { OBJECTIVE_PAGES } from '@/lib/objective-schema';

export const metadata: Metadata = {
  title: 'Objectives',
  description: 'Peaks, routes, ski lines and races: what I have done and what is still on the list.',
};

export default function ObjectivesPage() {
  const items = getObjectiveCatalog();

  return (
    <PageContainer width="wide">
      <Link
        href="/adventures"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
      >
        ← Adventures
      </Link>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">Objectives</h1>
        <p className="mt-2 text-gray-600 dark:text-[#cccccc]">
          Peaks, routes, ski lines and races: what I&apos;ve done and what&apos;s still on the list.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OBJECTIVE_PAGES.map((p) => {
          const mine = items.filter((i) => i.page === p.id);
          const done = mine.filter((i) => i.done).length;
          return (
            <Link
              key={p.id}
              href={`/adventures/objectives/${p.id}`}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-[#303031] dark:bg-[#252526] dark:hover:border-[#454545] dark:hover:bg-[#2a2a2b]"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#d4d4d4]">{p.label}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-[#cccccc]">{p.blurb}</p>
              <p className="mt-2 text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {done} / {mine.length} done
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-[#a6a6a6]">
                {p.sections.map((s) => s.label).join(' · ')}
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 mt-12 text-2xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Everything on one map</h2>
      <CatalogMap items={items} />
    </PageContainer>
  );
}
