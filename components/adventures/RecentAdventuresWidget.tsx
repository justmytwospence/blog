import Link from 'next/link';
import { AdventureCard } from './AdventureCard';
import type { AdventureSummary } from '@/lib/adventures';

/** The latest trip reports as cards, with a link to the rest. The page supplies the heading. */
export function RecentAdventuresWidget({ adventures }: { adventures: AdventureSummary[] }) {
  if (adventures.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adventures.map((a) => (
          <AdventureCard key={a.slug} adventure={a} />
        ))}
      </div>
      <Link
        href="/adventures"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-[#a6a6a6] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        View all adventures
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
