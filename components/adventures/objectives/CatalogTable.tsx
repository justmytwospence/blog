'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { regionName } from '../regions';
import { monthYear } from './format';
import type { CatalogItem } from '@/lib/adventures';
import type { PageConfig } from '@/lib/objective-schema';

type Col = 'name' | 'section' | 'region' | 'distance' | 'gain' | 'elevation' | 'done';

export function CatalogTable({ items, page }: { items: CatalogItem[]; page: PageConfig }) {
  const [col, setCol] = useState<Col>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const sectionLabel = (i: CatalogItem) => page.sections.find((s) => s.id === i.sections[0])?.label ?? '';
  const regionLabel = (i: CatalogItem) => (i.location ? regionName(i.location) : '');

  const columns: Array<{ key: Col; label: string; numeric?: boolean }> = [
    { key: 'name', label: 'Name' },
    { key: 'section', label: 'Section' },
    { key: 'region', label: 'Region' },
    { key: 'distance', label: 'Distance', numeric: true },
    { key: 'gain', label: 'Gain', numeric: true },
    { key: 'elevation', label: page.highPointLabel, numeric: true },
    { key: 'done', label: 'Done', numeric: true },
  ];

  const sorted = useMemo(() => {
    const val = (i: CatalogItem): number | string | null => {
      switch (col) {
        case 'name':
          return i.title.toLowerCase();
        case 'section':
          return sectionLabel(i).toLowerCase();
        case 'region':
          return regionLabel(i).toLowerCase();
        case 'distance':
          return i.distanceMi;
        case 'gain':
          return i.gainFt;
        case 'elevation':
          return i.elevationFt;
        case 'done':
          return i.doneDate;
      }
    };
    const sign = dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // nulls always last
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, col, dir]);

  function onSort(key: Col, numeric?: boolean) {
    if (key === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setCol(key);
      setDir(numeric ? 'desc' : 'asc');
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[#303031]">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-[#252526] dark:text-[#a6a6a6]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={col === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`px-3 py-2 ${c.numeric ? 'text-right' : ''}`}
              >
                <button type="button" onClick={() => onSort(c.key, c.numeric)} className="hover:text-gray-800 dark:hover:text-[#d4d4d4]">
                  {c.label}
                  {col === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#303031] dark:bg-[#1e1e1e]">
          {sorted.map((i) => (
            <tr key={i.slug}>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-[#d4d4d4]">
                {i.reportSlug ? (
                  <Link href={`/adventures/${i.reportSlug}`} className="text-emerald-700 hover:underline dark:text-emerald-400">
                    {i.title}
                  </Link>
                ) : i.link ? (
                  <a href={i.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {i.title}
                  </a>
                ) : (
                  i.title
                )}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-[#cccccc]">{sectionLabel(i)}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-[#cccccc]">{regionLabel(i)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{i.distanceMi != null ? `${i.distanceMi.toLocaleString('en-US')} mi` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{i.gainFt != null ? `${i.gainFt.toLocaleString('en-US')} ft` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{i.elevationFt != null ? `${i.elevationFt.toLocaleString('en-US')} ft` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{i.doneDate ? monthYear(i.doneDate) : i.done ? 'Done' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
