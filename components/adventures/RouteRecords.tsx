import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import type { TripRef } from '@/lib/adventures';

/**
 * Personal records across every repeat of the same route — something Strava's per-activity view and
 * segment leaderboards don't give you: your own fastest / biggest day on this exact route. The
 * current trip is marked "PR" where it holds the record; otherwise the record links to its trip.
 */
export function RouteRecords({ trips, activeSlug }: { trips: TripRef[]; activeSlug: string }) {
  if (trips.length <= 1) return null;

  const timed = trips.filter((t) => t.totals.movingTimeSeconds > 0);
  const fastest = timed.length
    ? timed.reduce((a, b) => (b.totals.movingTimeSeconds < a.totals.movingTimeSeconds ? b : a))
    : null;
  const mostVert = trips.reduce((a, b) => (b.totals.elevationGainMeters > a.totals.elevationGainMeters ? b : a));
  const longest = trips.reduce((a, b) => (b.totals.distanceMeters > a.totals.distanceMeters ? b : a));

  const records = [
    fastest && { label: 'Fastest', trip: fastest, value: formatDuration(fastest.totals.movingTimeSeconds) },
    { label: 'Most vert', trip: mostVert, value: formatElevation(mostVert.totals.elevationGainMeters) },
    { label: 'Longest', trip: longest, value: formatDistance(longest.totals.distanceMeters) },
  ].filter((r): r is { label: string; trip: TripRef; value: string } => Boolean(r));

  return (
    <section className="mb-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-[#6b6b6b]">
        Records on this route
      </div>
      <dl className="grid max-w-md grid-cols-3 gap-x-6 gap-y-2">
        {records.map((r) => {
          const current = r.trip.slug === activeSlug;
          return (
            <div key={r.label}>
              <dt className="text-xs text-gray-400 dark:text-[#6b6b6b]">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-[#cccccc]">
                <span className="font-semibold tabular-nums">{r.value}</span>{' '}
                {current ? (
                  <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    PR
                  </span>
                ) : (
                  <Link
                    href={`/adventures/${r.trip.slug}`}
                    className="text-xs text-gray-400 hover:underline dark:text-[#6b6b6b]"
                  >
                    {formatDate(r.trip.date, 'short')}
                  </Link>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
