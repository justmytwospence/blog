import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { TripRef } from '@/lib/adventures';

/**
 * Tab bar for a route done more than once: one tab per trip (most-recent first), each linking to
 * that trip's report. Labelled by date since repeats usually share a title.
 */
export function TripTabs({ trips, activeSlug }: { trips: TripRef[]; activeSlug: string }) {
  if (trips.length <= 1) return null;
  // Surface the total lap count when a session repeats the route (Eldora, Bear) — more than once each.
  const totalLaps = trips.reduce((s, t) => s + t.laps, 0);
  return (
    <div className="mb-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-[#6b6b6b]">
        This route, {trips.length}×{totalLaps > trips.length ? ` · ${totalLaps} laps` : ''}
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trips on this route">
        {trips.map((t) => {
          const active = t.slug === activeSlug;
          return (
            <Link
              key={t.slug}
              href={`/adventures/${t.slug}`}
              role="tab"
              aria-selected={active}
              title={t.title}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-transparent bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc] dark:hover:bg-[#3a3d41]'
              }`}
            >
              {formatDate(t.date, 'short')}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
