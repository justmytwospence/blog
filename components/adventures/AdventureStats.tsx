import type { AdventureStats as Stats, SportType } from '@/lib/adventures';
import {
  formatDistance,
  formatElevation,
  formatDuration,
  formatPaceOrSpeed,
  type UnitSystem,
} from '@/lib/units';

function commas(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Responsive stat grid for a report (or one day of a trip). Omits cells whose data is absent. */
export function AdventureStats({
  stats,
  sportType,
  unit = 'imperial',
  className = '',
}: {
  stats: Stats;
  sportType: SportType;
  unit?: UnitSystem;
  className?: string;
}) {
  const paceSpeed = formatPaceOrSpeed(stats.avgSpeedMetersPerSec, sportType, unit);
  const items: Array<{ label: string; value: string }> = [
    { label: 'Distance', value: formatDistance(stats.distanceMeters, unit) },
    { label: 'Elevation gain', value: formatElevation(stats.elevationGainMeters, unit) },
    { label: 'Moving time', value: formatDuration(stats.movingTimeSeconds) },
    { label: paceSpeed.label, value: paceSpeed.value },
  ];
  if (stats.elevHighMeters != null)
    items.push({ label: 'High point', value: formatElevation(stats.elevHighMeters, unit) });
  if (stats.avgHeartrate != null)
    items.push({ label: 'Avg HR', value: `${Math.round(stats.avgHeartrate)} bpm` });
  if (stats.maxHeartrate != null)
    items.push({ label: 'Max HR', value: `${Math.round(stats.maxHeartrate)} bpm` });
  if (stats.calories != null) items.push({ label: 'Calories', value: commas(stats.calories) });
  if (stats.sufferScore != null)
    items.push({ label: 'Relative effort', value: commas(stats.sufferScore) });

  return (
    <dl
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-[#303031] dark:bg-[#303031] ${className}`}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-white px-4 py-3 dark:bg-[#252526]">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]">
            {it.label}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-[#d4d4d4]">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
