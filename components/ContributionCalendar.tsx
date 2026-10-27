'use client';

import projectNames from '@/lib/project-names';
import type { CSSProperties } from 'react';

type DayEntry = { c: number; r: string[] };

export interface ActivityData {
  /** First day of the window (inclusive). Older stored payloads lack it: then endDate - 364 days. */
  startDate?: string;
  endDate: string;
  maxCount: number;
  total: number;
  days: Record<string, DayEntry>;
}

// GitHub's contribution palette (light + dark): the empty colour, then the active ramp, palest first.
const EMPTY_LIGHT = '#ebedf0';
const EMPTY_DARK = '#161b22';
const RAMP_LIGHT = ['#9be9a8', '#40c463', '#30a14e', '#216e3a'];
const RAMP_DARK = ['#0e4429', '#006d32', '#26a641', '#39d353'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WINDOW_DAYS = 365;

/**
 * Maps a day's count to an intensity in (0, 1]: its percentile rank among the active (non-zero)
 * days, with ties sharing their mid-rank. Ranks rather than raw counts keep one huge day from
 * washing everything else out, and a continuous scale (instead of a few fixed levels) keeps every
 * distinct count distinguishable. Empty days map to 0.
 */
export function intensityScale(counts: number[]): (count: number) => number {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const rank = new Map<number, number>();
  for (let i = 0; i < active.length; ) {
    let j = i;
    while (j < active.length && active[j] === active[i]) j++;
    // Mid-rank of the tie block, so the busiest day lands at 1 and the quietest just above 0.
    rank.set(active[i], (i + j) / 2 / active.length);
    i = j;
  }
  const top = active.length ? rank.get(active[active.length - 1])! : 1;
  return (count) => (count <= 0 ? 0 : Math.max(0.0001, (rank.get(count) ?? 0) / top));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colour at intensity t in (0, 1], interpolated through the ramp's stops. */
export function rampColor(ramp: string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [hexToRgb(ramp[i]), hexToRgb(ramp[i + 1])];
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix.join(' ')})`;
}

function addDaysUTC(date: Date, n: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fmtDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function dayHeadline(count: number, date: Date): string {
  if (count <= 0) return `No contributions on ${fmtDay(date)}`;
  return `${count} contribution${count === 1 ? '' : 's'} on ${fmtDay(date)}`;
}

/** Counts include private work; only public projects are ever named. */
export function dayTitle(count: number, date: Date, names: string[]): string {
  if (count <= 0) return dayHeadline(count, date);
  return `${dayHeadline(count, date)} · ${names.length > 0 ? names.join(', ') : 'private or unlisted repositories'}`;
}

interface CalendarProps {
  data: ActivityData;
  focusSlugs: string[] | null;
  hoverDay: string | null;
  onDayEnter: (repos: string[], dayKey: string, count: number) => void;
  onLeave: () => void;
  /** Clicking a day pins it; clicking the pinned day again unpins. */
  pinnedDay?: string | null;
  onDayClick?: (repos: string[], dayKey: string, count: number) => void;
}

export function ContributionCalendar({ data, focusSlugs, hoverDay, onDayEnter, onLeave, pinnedDay = null, onDayClick }: CalendarProps) {
  // Exactly the last 365 days. The grid runs from the Sunday on or before the first day to the
  // Saturday on or after the last, so every column is a Sun–Sat week (365 days always make 53
  // columns); the padding cells outside the window are left blank, as on GitHub.
  const end = new Date(`${data.endDate}T00:00:00Z`);
  const start = data.startDate ? new Date(`${data.startDate}T00:00:00Z`) : addDaysUTC(end, -(WINDOW_DAYS - 1));
  const gridStart = addDaysUTC(start, -start.getUTCDay());
  const gridEnd = addDaysUTC(end, 6 - end.getUTCDay());
  const weeks = Math.round((gridEnd.getTime() - gridStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDaysUTC(gridStart, w * 7 + d);
      const entry = data.days[isoDay(date)];
      const inRange = date >= start && date <= end;
      return { key: isoDay(date), date, inRange, count: inRange ? entry?.c ?? 0 : 0, repos: inRange ? entry?.r ?? [] : [] };
    })
  );

  const intensity = intensityScale(columns.flat().map((cell) => cell.count));

  // A month is labelled over the first column whose first in-range day falls in it.
  const firstInRange = (col: typeof columns[number]) => col.find((cell) => cell.inRange)?.date ?? col[0].date;
  const monthLabels = columns.map((col, w) => {
    const month = firstInRange(col).getUTCMonth();
    const prev = w > 0 ? firstInRange(columns[w - 1]).getUTCMonth() : -1;
    if (month === prev) return '';
    // January also carries the year, so the turn of the year reads at a glance.
    return month === 0 ? `${MONTHS[0]} ’${String(firstInRange(col).getUTCFullYear()).slice(2)}` : MONTHS[month];
  });
  // A label needs about three columns of room: drop one that would run into the next label or off
  // the end of the grid (a partial first or last month), as GitHub does.
  const MIN_LABEL_COLUMNS = 3;
  for (let i = 0; i < monthLabels.length; i++) {
    if (!monthLabels[i]) continue;
    const next = monthLabels.findIndex((label, j) => j > i && label !== '');
    const room = (next === -1 ? monthLabels.length : next) - i;
    if (room < MIN_LABEL_COLUMNS) monthLabels[i] = '';
  }

  // An empty focus list dims every day (a topic none of whose projects saw work this year).
  const focusing = focusSlugs !== null;

  return (
    <div className="mb-10" onMouseLeave={onLeave}>
      {/* Month labels — mirrors the week columns so they stay aligned */}
      <div className="flex gap-2">
        <div className="w-8 shrink-0" aria-hidden="true" />
        <div className="flex flex-1 gap-[3px]" aria-hidden="true">
          {monthLabels.map((label, i) => (
            <div key={i} className="min-w-0 flex-1 whitespace-nowrap text-[11px] font-medium tracking-wide text-gray-500 dark:text-[#8b8b8b] leading-5">
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex gap-2">
        {/* Weekday labels, one per row */}
        <div className="flex w-8 shrink-0 flex-col gap-[3px] text-[11px] font-medium tracking-wide text-gray-500 dark:text-[#8b8b8b]" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => (
            <div key={i} className="flex flex-1 items-center justify-end leading-none">
              {label}
            </div>
          ))}
        </div>

        {/* Week columns — each grows equally to fill the width; cells stay square.
            Exposed as a single labelled image so assistive tech gets the summary
            rather than 365 individual cells. */}
        <div
          className="flex flex-1 gap-[3px]"
          role="img"
          aria-label={`GitHub contribution activity over the past year: ${data.total.toLocaleString('en-US')} contributions.`}
        >
          {columns.map((col, wi) => (
            <div key={wi} className="flex flex-1 flex-col gap-[3px]">
              {col.map((cell) => {
                if (!cell.inRange) {
                  return <div key={cell.key} className="aspect-square w-full" aria-hidden="true" />;
                }
                const t = intensity(cell.count);
                const matches = !focusing || cell.repos.some((r) => focusSlugs!.includes(r));
                const isHovered = hoverDay === cell.key;
                const isPinned = pinnedDay === cell.key;
                const names = cell.repos.map((s) => projectNames[s] ?? s);
                const title = dayTitle(cell.count, cell.date, names);
                return (
                  <div
                    key={cell.key}
                    title={title}
                    onMouseEnter={() => onDayEnter(cell.repos, cell.key, cell.count)}
                    onClick={() => onDayClick?.(cell.repos, cell.key, cell.count)}
                    data-day={cell.key}
                    style={{
                      '--heat-light': t > 0 ? rampColor(RAMP_LIGHT, t) : EMPTY_LIGHT,
                      '--heat-dark': t > 0 ? rampColor(RAMP_DARK, t) : EMPTY_DARK,
                    } as CSSProperties}
                    className={`aspect-square w-full rounded-[2px] transition-opacity duration-150 bg-(--heat-light) dark:bg-(--heat-dark) ${
                      focusing && !matches ? 'opacity-20' : 'opacity-100'
                    } ${
                      isPinned
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                        : isHovered
                          ? 'ring-1 ring-gray-500 dark:ring-gray-300'
                          : ''
                    } ${onDayClick ? 'cursor-pointer' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
