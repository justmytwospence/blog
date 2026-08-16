'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { ObjectiveCard } from './ObjectiveCard';
import { ObjectivesMap } from './ObjectivesMap';
import { regionName } from './regionCentroids';
import type { Objective } from '@/lib/adventures';
import { LIST_ORDER, LIST_LABELS } from '@/lib/objective-lists';
import type { ObjectiveList, ObjectiveListItem } from '@/lib/objective-lists';

function uniq(arr: Array<string | null | undefined>): string[] {
  return Array.from(new Set(arr.filter((x): x is string => Boolean(x)))).sort();
}

const selectCls =
  'rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc]';

const pillCls = (active: boolean) =>
  `rounded-full px-3 py-1 text-sm transition-colors ${
    active
      ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#3a3d41] dark:text-[#cccccc] dark:hover:bg-[#454545]'
  }`;

// The wishlist is the default tab; named lists are keyed by their kebab id.
const WISHLIST = 'wishlist';

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

/** The original wishlist UI: map + Type/Region/Season filters + grouped grid. */
function WishlistView({ objectives }: { objectives: Objective[] }) {
  const [type, setType] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'type' | 'location'>('type');

  const types = useMemo(() => uniq(objectives.map((o) => o.type)), [objectives]);
  const locs = useMemo(() => uniq(objectives.map((o) => o.location)), [objectives]);
  const seasons = useMemo(() => uniq(objectives.flatMap((o) => o.season ?? [])), [objectives]);

  const filtered = objectives
    .filter((o) => !type || o.type === type)
    .filter((o) => !loc || o.location === loc)
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

  if (objectives.length === 0) {
    return <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Nothing on the wishlist yet.</div>;
  }

  return (
    <>
      <div className="mb-6">
        <ObjectivesMap objectives={objectives} onRegionClick={(c) => setLoc((cur) => (cur === c ? null : c))} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterSelect label="Type" value={type} onChange={setType} options={types} />
        <FilterSelect label="Region" value={loc} onChange={setLoc} options={locs} labelFn={regionName} />
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

/** One checklist row — done items link to their report, todo items are a muted unchecked line. */
function ChecklistRow({ item }: { item: ObjectiveListItem }) {
  const mark = item.done ? (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-gray-300 dark:border-[#3a3d41]"
    />
  );

  const body = (
    <div className="min-w-0">
      <p
        className={`truncate font-medium ${
          item.done ? 'text-gray-900 dark:text-[#d4d4d4]' : 'text-gray-500 dark:text-[#a6a6a6]'
        }`}
      >
        {item.name}
      </p>
      <p className="truncate text-sm text-gray-500 dark:text-[#a6a6a6]">{item.detail}</p>
    </div>
  );

  const inner = (
    <>
      {mark}
      {body}
      {item.region && (
        <span className="ml-auto shrink-0 self-start rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-[#3a3d41] dark:text-[#cccccc]">
          {item.region}
        </span>
      )}
    </>
  );

  const base =
    'flex items-start gap-3 rounded-lg border bg-white p-3 dark:bg-[#252526]';

  if (item.done && item.completedSlug) {
    return (
      <Link
        href={`/adventures/${item.completedSlug}`}
        className={`${base} border-emerald-200 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-emerald-900/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={`${base} ${item.done ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-gray-200 dark:border-[#303031]'}`}>
      {inner}
    </div>
  );
}

/** A named list rendered as a checklist: "<done> / <total> done" header + the items in given order. */
function ChecklistView({ list }: { list: ObjectiveList }) {
  const total = list.items.length;
  const done = list.items.filter((i) => i.done).length;
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-[#a6a6a6]">
          {list.label}{' '}
          <span className="text-sm font-normal tabular-nums text-emerald-600 dark:text-emerald-400">
            {done} / {total} done
          </span>
        </h2>
        {list.note && <p className="mt-0.5 text-sm text-gray-500 dark:text-[#a6a6a6]">{list.note}</p>}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {list.items.map((item) => (
          <ChecklistRow key={`${item.name}-${item.detail}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export function ObjectivesView({
  objectives,
  lists,
}: {
  objectives: Objective[];
  lists: ObjectiveList[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Present named lists in LIST_ORDER, keeping only those actually shipped in the data.
  const orderedLists = useMemo(() => {
    const byId = new Map(lists.map((l) => [l.id, l]));
    return LIST_ORDER.map((id) => byId.get(id)).filter((l): l is ObjectiveList => Boolean(l));
  }, [lists]);

  const validIds = useMemo(() => new Set(orderedLists.map((l) => l.id)), [orderedLists]);
  const readList = (v: string | null): string => (v && validIds.has(v) ? v : WISHLIST);

  const [active, setActive] = useState<string>(() => readList(params.get('list')));

  // Keep the URL in sync so a selected list is shareable (?list=14ers); wishlist is the bare URL.
  useEffect(() => {
    const q = new URLSearchParams();
    if (active !== WISHLIST) q.set('list', active);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [active, pathname, router]);

  // Restore from the URL on back/forward navigation.
  useEffect(() => {
    setActive(readList(params.get('list')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const activeList = orderedLists.find((l) => l.id === active) ?? null;

  return (
    <>
      {orderedLists.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActive(WISHLIST)}
            aria-pressed={active === WISHLIST}
            className={pillCls(active === WISHLIST)}
          >
            Wishlist
          </button>
          {orderedLists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActive(l.id)}
              aria-pressed={active === l.id}
              className={pillCls(active === l.id)}
            >
              {LIST_LABELS[l.id] ?? l.label}
            </button>
          ))}
        </div>
      )}

      {activeList ? <ChecklistView list={activeList} /> : <WishlistView objectives={objectives} />}
    </>
  );
}
