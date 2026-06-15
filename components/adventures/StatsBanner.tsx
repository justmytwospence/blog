import Link from 'next/link';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import type { LifetimeStats } from '@/lib/adventures';

export function StatsBanner({ stats }: { stats: LifetimeStats }) {
  if (stats.adventureCount === 0) return null;
  const { records } = stats;

  const recordChips = [
    records.longestDistance && {
      label: 'Longest',
      slug: records.longestDistance.slug,
      title: records.longestDistance.title,
      value: formatDistance(records.longestDistance.totals.distanceMeters),
    },
    records.mostVert && {
      label: 'Most vert',
      slug: records.mostVert.slug,
      title: records.mostVert.title,
      value: formatElevation(records.mostVert.totals.elevationGainMeters),
    },
    records.longestDuration && {
      label: 'Longest day',
      slug: records.longestDuration.slug,
      title: records.longestDuration.title,
      value: formatDuration(records.longestDuration.totals.movingTimeSeconds),
    },
    records.highestPoint && {
      label: 'Highest point',
      slug: records.highestPoint.slug,
      title: records.highestPoint.title,
      value: formatElevation(records.highestPoint.meters),
    },
  ].filter((c): c is { label: string; slug: string; title: string; value: string } => Boolean(c));

  if (recordChips.length === 0) return null;

  return (
    <section className="mb-2" aria-label="Records">
      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Records</h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        {recordChips.map((c) => (
          <div key={c.label}>
            <dt className="text-xs uppercase tracking-wide text-gray-400 dark:text-[#6b6b6b]">{c.label}</dt>
            <dd className="mt-0.5 text-sm text-gray-700 dark:text-[#cccccc]">
              <span className="font-semibold tabular-nums">{c.value}</span>
              <br />
              <Link
                href={`/adventures/${c.slug}`}
                className="text-gray-500 hover:text-gray-700 hover:underline dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
              >
                {c.title}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
