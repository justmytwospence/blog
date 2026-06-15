'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import { sportMeta } from './sportMeta';
import type { AdventureSummary } from '@/lib/adventures';

type Col = 'date' | 'name' | 'sport' | 'location' | 'distance' | 'elevation' | 'time';

function locLabel(a: AdventureSummary): string {
  return a.location.state ?? a.location.country ?? '';
}

function value(a: AdventureSummary, col: Col): number | string {
  switch (col) {
    case 'name':
      return a.title.toLowerCase();
    case 'sport':
      return a.sportType;
    case 'location':
      return locLabel(a).toLowerCase();
    case 'distance':
      return a.totals.distanceMeters;
    case 'elevation':
      return a.totals.elevationGainMeters;
    case 'time':
      return a.totals.movingTimeSeconds;
    case 'date':
    default:
      return a.date;
  }
}

const COLUMNS: Array<{ key: Col; label: string; numeric?: boolean }> = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'sport', label: 'Sport' },
  { key: 'location', label: 'Location' },
  { key: 'distance', label: 'Distance', numeric: true },
  { key: 'elevation', label: 'Vert', numeric: true },
  { key: 'time', label: 'Time', numeric: true },
];

export function AdventuresTable({ items }: { items: AdventureSummary[] }) {
  const [col, setCol] = useState<Col>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const va = value(a, col);
      const vb = value(b, col);
      const r =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return dir === 'asc' ? r : -r;
    });
    return copy;
  }, [items, col, dir]);

  const onSort = (c: Col) => {
    if (c === col) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCol(c);
      setDir(c === 'name' || c === 'sport' || c === 'location' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[#303031]">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 dark:border-[#303031] dark:bg-[#252526] dark:text-[#a6a6a6]">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={col === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`px-3 py-2 font-medium ${c.numeric ? 'text-right' : 'text-left'}`}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-[#d4d4d4]"
                >
                  {c.label}
                  {col === c.key && <span aria-hidden="true">{dir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const m = sportMeta(a.sportType);
            return (
              <tr
                key={a.slug}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-[#2a2a2b] dark:hover:bg-[#252526]"
              >
                <td className="whitespace-nowrap px-3 py-2 text-gray-500 dark:text-[#a6a6a6]">
                  {formatDate(a.date, 'short')}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/adventures/${a.slug}`}
                    className="font-medium text-gray-900 hover:text-blue-600 dark:text-[#d4d4d4] dark:hover:text-blue-400"
                  >
                    {a.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-[#cccccc]">
                  <span className="inline-flex items-center gap-1">
                    <m.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {m.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-[#cccccc]">{locLabel(a)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-[#cccccc]">
                  {formatDistance(a.totals.distanceMeters)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-[#cccccc]">
                  {formatElevation(a.totals.elevationGainMeters)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-[#cccccc]">
                  {formatDuration(a.totals.movingTimeSeconds)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
