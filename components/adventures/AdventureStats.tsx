import type { AdventureStats as Stats, SportType } from '@/lib/adventures';
import {
  formatDistance,
  formatElevation,
  formatDuration,
  formatPaceOrSpeed,
  type UnitSystem,
} from '@/lib/units';

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
  ];
  // Manual route imports have no recorded time, so moving time / pace don't apply.
  if (stats.movingTimeSeconds > 0) {
    items.push({ label: 'Moving time', value: formatDuration(stats.movingTimeSeconds) });
    items.push({ label: paceSpeed.label, value: paceSpeed.value });
  }
  if (stats.elevHighMeters != null)
    items.push({ label: 'High point', value: formatElevation(stats.elevHighMeters, unit) });
  if (stats.avgHeartrate != null)
    items.push({ label: 'Avg HR', value: `${Math.round(stats.avgHeartrate)} bpm` });
  if (stats.maxHeartrate != null)
    items.push({ label: 'Max HR', value: `${Math.round(stats.maxHeartrate)} bpm` });

  return (
    // Flex-wrap (not a fixed grid) so cells grow to fill every row, including the last — no empty
    // gray cells when the count doesn't divide evenly. min/basis keeps them readable as it wraps.
    <dl
      className={`flex flex-wrap gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-[#303031] dark:bg-[#303031] ${className}`}
    >
      {items.map((it) => (
        <div key={it.label} className="grow basis-[150px] bg-white px-4 py-3 dark:bg-[#252526]">
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
