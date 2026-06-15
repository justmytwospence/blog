import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import type { TripRef } from '@/lib/adventures';

type Record = { label: string; value: string; trip: TripRef | null; sub?: string };

/**
 * Personal records across every repeat of the same route — something Strava's per-activity view and
 * segment leaderboards don't give you. For a lap route (Eldora, Bear) it counts total laps across all
 * sessions and the best per-lap moving pace; for a point-to-point route done more than once it's your
 * fastest / biggest day. The current trip is marked "PR" where it holds the record.
 */
export function RouteRecords({
  trips,
  activeSlug,
  isLaps,
}: {
  trips: TripRef[];
  activeSlug: string;
  isLaps: boolean;
}) {
  if (trips.length <= 1) return null;

  const timed = trips.filter((t) => t.totals.movingTimeSeconds > 0);
  const mostVert = trips.reduce((a, b) => (b.totals.elevationGainMeters > a.totals.elevationGainMeters ? b : a));
  const longest = trips.reduce((a, b) => (b.totals.distanceMeters > a.totals.distanceMeters ? b : a));

  let rows: (Record | null)[];
  if (isLaps) {
    const totalLaps = trips.reduce((s, t) => s + t.laps, 0);
    const lapPace = (t: TripRef) => t.totals.movingTimeSeconds / t.laps;
    const paced = timed.filter((t) => t.laps > 0);
    const fastestLap = paced.length ? paced.reduce((a, b) => (lapPace(b) < lapPace(a) ? b : a)) : null;
    rows = [
      { label: 'Laps', value: String(totalLaps), trip: null, sub: `${trips.length} sessions` },
      fastestLap && { label: 'Fastest lap', value: formatDuration(Math.round(lapPace(fastestLap))), trip: fastestLap },
      { label: 'Most vert', value: formatElevation(mostVert.totals.elevationGainMeters), trip: mostVert },
    ];
  } else {
    const fastest = timed.length
      ? timed.reduce((a, b) => (b.totals.movingTimeSeconds < a.totals.movingTimeSeconds ? b : a))
      : null;
    rows = [
      fastest && { label: 'Fastest', value: formatDuration(fastest.totals.movingTimeSeconds), trip: fastest },
      { label: 'Most vert', value: formatElevation(mostVert.totals.elevationGainMeters), trip: mostVert },
      { label: 'Longest', value: formatDistance(longest.totals.distanceMeters), trip: longest },
    ];
  }
  const records = rows.filter((r): r is Record => r !== null);

  return (
    <section className="mb-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-[#6b6b6b]">
        Records on this route
      </div>
      <dl className="grid max-w-md grid-cols-3 gap-x-6 gap-y-2">
        {records.map((r) => {
          const current = r.trip?.slug === activeSlug;
          return (
            <div key={r.label}>
              <dt className="text-xs text-gray-400 dark:text-[#6b6b6b]">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-[#cccccc]">
                <span className="font-semibold tabular-nums">{r.value}</span>{' '}
                {r.sub ? (
                  <span className="text-xs text-gray-400 dark:text-[#6b6b6b]">{r.sub}</span>
                ) : current ? (
                  <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    PR
                  </span>
                ) : r.trip ? (
                  <Link
                    href={`/adventures/${r.trip.slug}`}
                    className="text-xs text-gray-400 hover:underline dark:text-[#6b6b6b]"
                  >
                    {formatDate(r.trip.date, 'short')}
                  </Link>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
