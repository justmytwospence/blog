'use client';

import { useMemo, useState } from 'react';
import { ObjectiveCard } from './ObjectiveCard';
import { ObjectivesMap } from './ObjectivesMap';
import { regionName } from './regionCentroids';
import type { Objective } from '@/lib/adventures';

function uniq(arr: Array<string | null | undefined>): string[] {
  return Array.from(new Set(arr.filter((x): x is string => Boolean(x)))).sort();
}

const selectCls =
  'rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc]';

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labelFn,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  labelFn?: (s: string) => string;
}) {
  if (options.length <= 1) return null;
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#a6a6a6]">
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className={selectCls}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelFn ? labelFn(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ObjectivesView({ objectives }: { objectives: Objective[] }) {
  const [type, setType] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'type' | 'location'>('type');

  const types = useMemo(() => uniq(objectives.map((o) => o.type)), [objectives]);
  const locs = useMemo(() => uniq(objectives.map((o) => o.location)), [objectives]);
  const diffs = useMemo(() => uniq(objectives.map((o) => o.difficulty)), [objectives]);
  const seasons = useMemo(() => uniq(objectives.flatMap((o) => o.season ?? [])), [objectives]);

  const filtered = objectives
    .filter((o) => !type || o.type === type)
    .filter((o) => !loc || o.location === loc)
    .filter((o) => !diff || o.difficulty === diff)
    .filter((o) => !season || (o.season ?? []).includes(season));

  const groups = useMemo(() => {
    const m = new Map<string, Objective[]>();
    for (const o of filtered) {
      const key = (groupBy === 'type' ? o.type : o.location) ?? 'other';
      const arr = m.get(key) ?? [];
      arr.push(o);
      m.set(key, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const groupLabel = (k: string) => (groupBy === 'location' ? regionName(k) : k);

  return (
    <>
      <div className="mb-6">
        <ObjectivesMap objectives={objectives} onRegionClick={(c) => setLoc((cur) => (cur === c ? null : c))} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterSelect label="Type" value={type} onChange={setType} options={types} />
        <FilterSelect label="Region" value={loc} onChange={setLoc} options={locs} labelFn={regionName} />
        <FilterSelect label="Difficulty" value={diff} onChange={setDiff} options={diffs} />
        <FilterSelect label="Season" value={season} onChange={setSeason} options={seasons} />
        <div className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#a6a6a6]">
          Group by
          <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-[#303031]">
            {(['type', 'location'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                aria-pressed={groupBy === g}
                className={`px-2.5 py-1.5 text-sm capitalize ${
                  groupBy === g
                    ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-[#252526] dark:text-[#cccccc] dark:hover:bg-[#3a3d41]'
                }`}
              >
                {g === 'location' ? 'region' : g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">No objectives match these filters.</div>
      ) : (
        <div className="space-y-8">
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-3 text-lg font-semibold capitalize text-gray-700 dark:text-[#a6a6a6]">
                {groupLabel(key)}{' '}
                <span className="text-sm font-normal text-gray-400 dark:text-[#6b6b6b]">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((o) => (
                  <ObjectiveCard key={o.slug} objective={o} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
