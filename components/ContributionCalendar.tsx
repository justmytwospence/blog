'use client';

import projectNames from '@/lib/project-names';

type DayEntry = { c: number; r: string[] };

export interface ActivityData {
  /** First day of the window (inclusive). Older stored payloads lack it: then endDate - 364 days. */
  startDate?: string;
  endDate: string;
  maxCount: number;
  total: number;
  days: Record<string, DayEntry>;
}

// GitHub's contribution palette (light + dark), indexed by intensity level 0–4.
const LEVEL_LIGHT = ['bg-[#ebedf0]', 'bg-[#9be9a8]', 'bg-[#40c463]', 'bg-[#30a14e]', 'bg-[#216e3a]'];
const LEVEL_DARK = ['dark:bg-[#161b22]', 'dark:bg-[#0e4429]', 'dark:bg-[#006d32]', 'dark:bg-[#26a641]', 'dark:bg-[#39d353]'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WINDOW_DAYS = 365;

function level(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
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

  const focusing = focusSlugs !== null && focusSlugs.length > 0;

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
                const lvl = level(cell.count);
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
                    className={`aspect-square w-full rounded-[2px] transition-opacity duration-150 ${LEVEL_LIGHT[lvl]} ${LEVEL_DARK[lvl]} ${
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
