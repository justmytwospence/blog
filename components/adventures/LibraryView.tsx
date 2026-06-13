'use client';

import { useMemo, useState } from 'react';
import { AdventureCard } from './AdventureCard';
import { sportMeta } from './sportMeta';
import type { AdventureSummary, SportType } from '@/lib/adventures';

type SortKey = 'date' | 'distance' | 'elevation' | 'time';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Newest' },
  { key: 'distance', label: 'Distance' },
  { key: 'elevation', label: 'Elevation' },
  { key: 'time', label: 'Time' },
];

function locationLabel(a: AdventureSummary): string | null {
  return a.location.state ?? a.location.country ?? null;
}

export function LibraryView({ adventures }: { adventures: AdventureSummary[] }) {
  const [sport, setSport] = useState<SportType | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');

  const sports = useMemo(
    () => Array.from(new Set(adventures.map((a) => a.sportType))).sort() as SportType[],
    [adventures],
  );
  const places = useMemo(
    () =>
      Array.from(
        new Set(adventures.map(locationLabel).filter((p): p is string => Boolean(p))),
      ).sort(),
    [adventures],
  );

  const sorted = useMemo(() => {
    const list = adventures
      .filter((a) => !sport || a.sportType === sport)
      .filter((a) => !place || locationLabel(a) === place);
    list.sort((a, b) => {
      switch (sortKey) {
        case 'distance':
          return b.totals.distanceMeters - a.totals.distanceMeters;
        case 'elevation':
          return b.totals.elevationGainMeters - a.totals.elevationGainMeters;
        case 'time':
          return b.totals.movingTimeSeconds - a.totals.movingTimeSeconds;
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
    return list;
  }, [adventures, sport, place, sortKey]);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition-colors ${
      active
        ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#3a3d41] dark:text-[#cccccc] dark:hover:bg-[#454545]'
    }`;

  const selectCls =
    'rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc]';

  if (adventures.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">
        Adventures are not available right now. Check back soon!
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {sports.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSport(null)}
              aria-pressed={sport === null}
              className={pill(sport === null)}
            >
              All sports
            </button>
            {sports.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                aria-pressed={sport === s}
                className={pill(sport === s)}
              >
                {sportMeta(s).label}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {places.length > 1 && (
            <select
              value={place ?? ''}
              onChange={(e) => setPlace(e.target.value || null)}
              aria-label="Filter by location"
              className={selectCls}
            >
              <option value="">All locations</option>
              {places.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#a6a6a6]">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort adventures"
              className={selectCls}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">
          No adventures match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((a) => (
            <AdventureCard key={a.slug} adventure={a} />
          ))}
        </div>
      )}
    </>
  );
}
