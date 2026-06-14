'use client';

import projectNames from '@/lib/project-names';

type DayEntry = { c: number; r: string[] };

export interface ActivityData {
  endDate: string;
  maxCount: number;
  total: number;
  days: Record<string, DayEntry>;
}

// GitHub's contribution palette (light + dark), indexed by intensity level 0–4.
const LEVEL_LIGHT = ['bg-[#ebedf0]', 'bg-[#9be9a8]', 'bg-[#40c463]', 'bg-[#30a14e]', 'bg-[#216e3a]'];
const LEVEL_DARK = ['dark:bg-[#161b22]', 'dark:bg-[#0e4429]', 'dark:bg-[#006d32]', 'dark:bg-[#26a641]', 'dark:bg-[#39d353]'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKS = 53;
const CELL = 11; // px
const GAP = 3; // px

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

function fmtDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

interface CalendarProps {
  data: ActivityData;
  focusSlugs: string[] | null;
  hoverDay: string | null;
  onDayEnter: (repos: string[], dayKey: string) => void;
  onLeave: () => void;
}

export function ContributionCalendar({ data, focusSlugs, hoverDay, onDayEnter, onLeave }: CalendarProps) {
  // Anchor the grid to the Saturday of the snapshot's final week, then walk
  // back 53 weeks to a Sunday so every column is a full Sun–Sat week.
  const end = new Date(`${data.endDate}T00:00:00Z`);
  const gridEnd = addDaysUTC(end, 6 - end.getUTCDay());
  const gridStart = addDaysUTC(gridEnd, -(WEEKS * 7 - 1));

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDaysUTC(gridStart, w * 7 + d);
      const entry = data.days[isoDay(date)];
      return { key: isoDay(date), date, count: entry?.c ?? 0, repos: entry?.r ?? [] };
    })
  );

  const monthLabels = columns.map((col, w) => {
    const month = col[0].date.getUTCMonth();
    const prev = w > 0 ? columns[w - 1][0].date.getUTCMonth() : -1;
    return month !== prev ? MONTHS[month] : '';
  });

  const colsTemplate = `repeat(${WEEKS}, ${CELL}px)`;
  const rowsTemplate = `repeat(7, ${CELL}px)`;
  const focusing = focusSlugs !== null && focusSlugs.length > 0;

  return (
    <div className="mb-10">
      <div className="overflow-x-auto">
        <div className="inline-block" onMouseLeave={onLeave}>
          {/* Month labels */}
          <div className="ml-8 grid" style={{ gridTemplateColumns: colsTemplate, gap: `${GAP}px` }}>
            {monthLabels.map((label, i) => (
              <div key={i} className="h-4 whitespace-nowrap text-[10px] leading-4 text-gray-400 dark:text-[#6e6e6e]">
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Weekday labels (Mon / Wed / Fri) */}
            <div
              className="grid w-7 shrink-0 text-[10px] text-gray-400 dark:text-[#6e6e6e]"
              style={{ gridTemplateRows: rowsTemplate, gap: `${GAP}px` }}
              aria-hidden="true"
            >
              <div />
              <div className="leading-[11px]">Mon</div>
              <div />
              <div className="leading-[11px]">Wed</div>
              <div />
              <div className="leading-[11px]">Fri</div>
              <div />
            </div>

            {/* Day cells, filled column-by-column (one column per week). The
                grid is exposed as a single labelled image so assistive tech
                gets the summary instead of 371 individual cells. */}
            <div
              className="grid"
              role="img"
              aria-label={`GitHub contribution activity over the past year: ${data.total.toLocaleString('en-US')} contributions.`}
              style={{
                gridTemplateColumns: colsTemplate,
                gridTemplateRows: rowsTemplate,
                gridAutoFlow: 'column',
                gap: `${GAP}px`,
              }}
            >
              {columns.flatMap((col) =>
                col.map((cell) => {
                  const lvl = level(cell.count);
                  const matches = !focusing || cell.repos.some((r) => focusSlugs!.includes(r));
                  const isHovered = hoverDay === cell.key;
                  const names = cell.repos.map((s) => projectNames[s] ?? s);
                  const title =
                    cell.count > 0
                      ? `${cell.count} commit${cell.count === 1 ? '' : 's'} on ${fmtDay(cell.date)} · ${names.join(', ')}`
                      : `No commits on ${fmtDay(cell.date)}`;
                  return (
                    <div
                      key={cell.key}
                      title={title}
                      onMouseEnter={() => onDayEnter(cell.repos, cell.key)}
                      className={`h-[11px] w-[11px] rounded-[2px] transition-opacity duration-150 ${LEVEL_LIGHT[lvl]} ${LEVEL_DARK[lvl]} ${
                        focusing && !matches ? 'opacity-20' : 'opacity-100'
                      } ${isHovered ? 'ring-1 ring-gray-500 dark:ring-gray-300' : ''}`}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Caption + legend */}
          <div className="ml-8 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-gray-500 dark:text-[#a6a6a6]">
              {data.total.toLocaleString('en-US')} contributions in the last year
            </span>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#6e6e6e]">
              <span className="mr-1">Less</span>
              {[0, 1, 2, 3, 4].map((l) => (
                <div key={l} className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_LIGHT[l]} ${LEVEL_DARK[l]}`} />
              ))}
              <span className="ml-1">More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
