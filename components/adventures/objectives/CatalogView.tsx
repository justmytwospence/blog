'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, Map as MapIcon, Table as TableIcon, Search } from 'lucide-react';
import { CatalogCard } from './CatalogCard';
import { CatalogMap } from './CatalogMap';
import { CatalogTable } from './CatalogTable';
import { regionName } from '../regions';
import { OBJECTIVE_SEASONS, pageConfig } from '@/lib/objective-schema';
import type { PageId, SortKey } from '@/lib/objective-schema';
import type { CatalogItem } from '@/lib/adventures';

type View = 'grid' | 'map' | 'table';
type Status = 'all' | 'done' | 'todo';

const SORT_KEYS: SortKey[] = ['name', 'distance', 'gain', 'elevation', 'done'];

const VIEWS: Array<{ key: View; label: string; Icon: typeof LayoutGrid }> = [
  { key: 'grid', label: 'Grid', Icon: LayoutGrid },
  { key: 'map', label: 'Map', Icon: MapIcon },
  { key: 'table', label: 'Table', Icon: TableIcon },
];

const pill = (active: boolean) =>
  `rounded-full px-3 py-1 text-sm transition-colors ${
    active
      ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#3a3d41] dark:text-[#cccccc] dark:hover:bg-[#454545]'
  }`;
const selectCls =
  'rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc]';

const nullsLast = (a: number | null, b: number | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : b - a);

export function CatalogView({ page, items }: { page: PageId; items: CatalogItem[] }) {
  const cfg = pageConfig(page)!;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const readView = (v: string | null): View => (v === 'map' || v === 'table' ? v : 'grid');
  const readStatus = (v: string | null): Status => (v === 'done' || v === 'todo' ? v : 'all');
  const readSort = (v: string | null): SortKey => (SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : cfg.defaultSort);

  const [view, setView] = useState<View>(() => readView(params.get('view')));
  const [section, setSection] = useState<string | null>(() => params.get('section') || null);
  const [status, setStatus] = useState<Status>(() => readStatus(params.get('status')));
  const [region, setRegion] = useState<string | null>(() => params.get('region') || null);
  const [season, setSeason] = useState<string | null>(() => params.get('season') || null);
  const [query, setQuery] = useState<string>(() => params.get('q') || '');
  const [sortKey, setSortKey] = useState<SortKey>(() => readSort(params.get('sort')));

  // Keep the URL in sync so a filtered/sorted view is shareable. Defaults are omitted.
  useEffect(() => {
    const q = new URLSearchParams();
    if (view !== 'grid') q.set('view', view);
    if (section) q.set('section', section);
    if (status !== 'all') q.set('status', status);
    if (region) q.set('region', region);
    if (season) q.set('season', season);
    if (query.trim()) q.set('q', query.trim());
    if (sortKey !== cfg.defaultSort) q.set('sort', sortKey);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, section, status, region, season, query, sortKey, pathname, router]);

  // Restore state from the URL on back/forward navigation.
  useEffect(() => {
    setView(readView(params.get('view')));
    setSection(params.get('section') || null);
    setStatus(readStatus(params.get('status')));
    setRegion(params.get('region') || null);
    setSeason(params.get('season') || null);
    setQuery(params.get('q') || '');
    setSortKey(readSort(params.get('sort')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const sectionCounts = useMemo(
    () =>
      cfg.sections
        .map((s) => {
          const inSection = items.filter((i) => i.sections.includes(s.id));
          return { ...s, total: inSection.length, done: inSection.filter((i) => i.done).length };
        })
        .filter((s) => s.total > 0),
    [cfg, items],
  );

  const regions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.location).filter((l): l is string => Boolean(l)))).sort((a, b) =>
        regionName(a).localeCompare(regionName(b)),
      ),
    [items],
  );
  const seasons = useMemo(
    () => OBJECTIVE_SEASONS.filter((s) => items.some((i) => i.season.includes(s))),
    [items],
  );

  const filtered = useMemo(() => {
    const labelOf = (id: string) => cfg.sections.find((s) => s.id === id)?.label ?? id;
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (i: CatalogItem) => {
      if (terms.length === 0) return true;
      const hay = [i.title, i.location ? regionName(i.location) : null, i.range, i.description, ...i.sections.map(labelOf)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    };
    const list = items
      .filter((i) => !section || i.sections.includes(section))
      .filter((i) => status === 'all' || (status === 'done' ? i.done : !i.done))
      .filter((i) => !region || i.location === region)
      .filter((i) => !season || i.season.includes(season))
      .filter(matches);
    list.sort((a, b) => {
      switch (sortKey) {
        case 'distance':
          return nullsLast(a.distanceMi, b.distanceMi);
        case 'gain':
          return nullsLast(a.gainFt, b.gainFt);
        case 'elevation':
          return nullsLast(a.elevationFt, b.elevationFt);
        case 'done': {
          if (a.done !== b.done) return a.done ? -1 : 1;
          if (a.done && b.done) {
            const d = (b.doneDate ?? '').localeCompare(a.doneDate ?? '');
            if (d !== 0) return d;
          }
          return a.title.localeCompare(b.title);
        }
        default:
          return a.title.localeCompare(b.title);
      }
    });
    return list;
  }, [cfg, items, section, status, region, season, query, sortKey]);

  const scope = section ? items.filter((i) => i.sections.includes(section)) : items;
  const doneCount = scope.filter((i) => i.done).length;
  const pct = scope.length ? Math.round((doneCount / scope.length) * 100) : 0;

  const sortLabels: Record<SortKey, string> = {
    name: 'Name',
    distance: 'Distance',
    gain: 'Gain',
    elevation: cfg.highPointLabel,
    done: 'Recently done',
  };

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-[#cccccc]">
          <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{doneCount}</span> of{' '}
          <span className="tabular-nums">{scope.length}</span> done
        </p>
        <div className="mt-1.5 h-1.5 w-full max-w-md rounded bg-gray-200 dark:bg-[#3a3d41]" aria-hidden="true">
          <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSection(null)} aria-pressed={section === null} className={pill(section === null)}>
          All
        </button>
        {sectionCounts.map((s) => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)} aria-pressed={section === s.id} className={pill(section === s.id)}>
            {s.label} <span className="text-xs opacity-70 tabular-nums">{s.done}/{s.total}</span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Search…"
            aria-label="Search objectives"
            className="w-48 rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-[#303031] dark:bg-[#252526] dark:text-[#cccccc]"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Filter by status" className={selectCls}>
          <option value="all">All</option>
          <option value="done">Done</option>
          <option value="todo">To do</option>
        </select>
        {regions.length > 1 && (
          <select value={region ?? ''} onChange={(e) => setRegion(e.target.value || null)} aria-label="Filter by region" className={selectCls}>
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionName(r)}
              </option>
            ))}
          </select>
        )}
        {seasons.length > 0 && (
          <select value={season ?? ''} onChange={(e) => setSeason(e.target.value || null)} aria-label="Filter by season" className={selectCls}>
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        )}
        {view !== 'table' && (
          <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#a6a6a6]">
            Sort
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort objectives" className={selectCls}>
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {sortLabels[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex overflow-hidden rounded-md border border-gray-200 dark:border-[#303031]" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              title={v.label}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-sm ${
                view === v.key
                  ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
                  : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-[#252526] dark:text-[#cccccc] dark:hover:bg-[#3a3d41]'
              }`}
            >
              <v.Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-[#a6a6a6]">Nothing matches these filters.</div>
      ) : view === 'map' ? (
        <CatalogMap items={filtered} />
      ) : view === 'table' ? (
        <CatalogTable items={filtered} page={cfg} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <CatalogCard key={i.slug} item={i} cfg={cfg} />
          ))}
        </div>
      )}
    </>
  );
}
