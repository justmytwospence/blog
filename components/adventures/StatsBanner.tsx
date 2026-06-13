import Link from 'next/link';
import { sportMeta } from './sportMeta';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import type { LifetimeStats } from '@/lib/adventures';

export function StatsBanner({ stats }: { stats: LifetimeStats }) {
  if (stats.adventureCount === 0) return null;
  const { records } = stats;

  const headline: Array<{ label: string; value: string }> = [
    { label: 'Total distance', value: formatDistance(stats.totalDistanceMeters) },
    { label: 'Total vertical', value: formatElevation(stats.totalElevationGainMeters) },
    { label: 'Places', value: `${stats.states.length} states · ${stats.countries.length} countries` },
  ];
  if (records.highestPoint) {
    headline.push({ label: 'Highest point', value: formatElevation(records.highestPoint.meters) });
  }

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
  ].filter((c): c is { label: string; slug: string; title: string; value: string } => Boolean(c));

  return (
    <section className="mb-8" aria-label="Lifetime statistics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {headline.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#303031] dark:bg-[#252526]"
          >
            <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-[#d4d4d4]">
              {c.value}
            </div>
            <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {stats.bySport.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.bySport.map((s) => {
            const m = sportMeta(s.sportType);
            return (
              <span
                key={s.sportType}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-[#3a3d41] dark:text-[#cccccc]"
              >
                <m.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium">{m.label}</span>
                <span className="tabular-nums">
                  {formatDistance(s.distanceMeters)} · {formatElevation(s.elevationGainMeters)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {recordChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-[#a6a6a6]">
          {recordChips.map((c) => (
            <Link
              key={c.label}
              href={`/adventures/${c.slug}`}
              className="rounded-full border border-gray-200 px-2.5 py-1 transition-colors hover:bg-gray-100 dark:border-[#303031] dark:hover:bg-[#3a3d41]"
            >
              <span className="font-medium text-gray-700 dark:text-[#cccccc]">{c.label}:</span>{' '}
              {c.value} · {c.title}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
