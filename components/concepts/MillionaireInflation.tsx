'use client';

import { type CSSProperties, type MouseEvent as RMouseEvent, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import data from '@/data/millionaire/yardsticks.json';

// Built by scripts/millionaire-data.py: for each year, today's dollars per $1 of that year, by yardstick.
type Key = 'cpi' | 'income' | 'homes' | 'tuition' | 'rank';
interface Row {
  year: number;
  cpi?: number;
  income?: number;
  homes?: number;
  tuition?: number;
  rank?: number;
  millionaireShare?: number;
}

const ROWS = data.rows as Row[];
const NOW = ROWS[ROWS.length - 1].year;
const BY_YEAR = new Map(ROWS.map((r) => [r.year, r]));
const LATEST_SHARE = ROWS.findLast((r) => r.millionaireShare != null)?.millionaireShare ?? 0;

const AGE_MIN = 18;
const AGE_MAX = 100;
const yearAt = (age: number) => NOW - (age - AGE_MIN);
const rowAt = (age: number) => BY_YEAR.get(yearAt(age));

interface Yardstick {
  key: Key;
  label: string;
  measures: string;
  light: string;
  dark: string;
}

const YARDSTICKS: Yardstick[] = [
  { key: 'cpi', label: 'Prices', measures: 'buys the same groceries, cars and haircuts (CPI)', light: '#0d9488', dark: '#2dd4bf' },
  { key: 'income', label: 'Paychecks', measures: 'is the same number of years of median household income', light: '#2563eb', dark: '#60a5fa' },
  { key: 'homes', label: 'Houses', measures: 'buys the same house (FHFA home price index)', light: '#ea580c', dark: '#fb923c' },
  { key: 'tuition', label: 'College', measures: 'pays the same number of years of tuition', light: '#9333ea', dark: '#c084fc' },
  { key: 'rank', label: 'Rank', measures: 'outranks the same share of U.S. households', light: '#e11d48', dark: '#fb7185' },
];
const FIRST_YEAR: Record<Key, number> = Object.fromEntries(
  YARDSTICKS.map((y) => [y.key, ROWS.find((r) => r[y.key] != null)!.year]),
) as Record<Key, number>;

const millions = (v: number) => (v >= 10 ? `$${v.toFixed(1)}M` : `$${v.toFixed(2)}M`);
const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

export default function MillionaireInflation() {
  const [age, setAge] = useState(35);
  const [hidden, setHidden] = useState<Set<Key>>(new Set());
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const color = (y: Yardstick) => (isDark ? y.dark : y.light);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const c = {
    grid: isDark ? '#26262f' : '#e8e8ee',
    axis: isDark ? '#6b7280' : '#9ca3af',
    text: isDark ? '#a6a6a6' : '#6b7280',
    bg: isDark ? '#141418' : '#ffffff',
  };

  const year = yearAt(age);
  const row = rowAt(age)!;
  const visible = YARDSTICKS.filter((y) => !hidden.has(y.key));
  const toggle = (key: Key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ---- chart geometry: age today on x, dollars needed today on a log y-axis ----
  const axisMax = Math.min(AGE_MAX, Math.max(70, age + 5));
  const ages = Array.from({ length: axisMax - AGE_MIN + 1 }, (_, i) => AGE_MIN + i);
  const peak = Math.max(
    2,
    ...visible.flatMap((y) => ages.map((a) => rowAt(a)?.[y.key] ?? 0)),
  );
  const yTickCandidates = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50];
  const yMax = yTickCandidates.find((t) => t >= peak) ?? peak;
  const yTicks = yTickCandidates.filter((t) => t <= yMax);

  const height = 360;
  const pad = { top: 26, right: 16, bottom: 42, left: 56 };
  const pw = Math.max(10, width - pad.left - pad.right);
  const ph = height - pad.top - pad.bottom;
  const sx = (a: number) => pad.left + ((a - AGE_MIN) / (axisMax - AGE_MIN)) * pw;
  const sy = (m: number) => pad.top + ph - (Math.log(m) / Math.log(yMax)) * ph;

  const pathFor = (key: Key) =>
    ages
      .map((a) => [a, rowAt(a)?.[key]] as const)
      .filter(([, v]) => v != null)
      .map(([a, v], i) => `${i ? 'L' : 'M'}${sx(a).toFixed(1)} ${sy(v as number).toFixed(1)}`)
      .join(' ');

  const xTicks = [18, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100].filter(
    (a, i, all) => a <= axisMax && (i === 0 || sx(a) - sx(all[i - 1]) >= 28),
  );

  const ageAt = (ev: RMouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = rect.width ? ((ev.clientX - rect.left) * width) / rect.width : ev.clientX - rect.left;
    if (px < pad.left - 8 || px > pad.left + pw + 8) return null;
    const a = Math.round(AGE_MIN + ((px - pad.left) / pw) * (axisMax - AGE_MIN));
    return Math.max(AGE_MIN, Math.min(axisMax, a));
  };

  const hover = hoverAge != null ? rowAt(hoverAge) : undefined;
  const hoverX = hoverAge != null ? sx(hoverAge) : 0;
  const tipRows = visible.filter((y) => hover?.[y.key] != null);
  const tipW = 150;
  const tipH = 22 + tipRows.length * 14;
  const tipX = hoverX + 10 + tipW > pad.left + pw ? hoverX - 10 - tipW : hoverX + 10;

  const sliderStyle = {
    '--accent': isDark ? '#e5e7eb' : '#374151',
    '--track': isDark ? '#3f3f46' : '#e5e7eb',
    '--pct': `${((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100}%`,
  } as CSSProperties;

  // The scorecard's bars share the chart's log scale so their lengths match the lines.
  const barPct = (m: number) => Math.max(2, (Math.log(m) / Math.log(Math.max(yMax, 2))) * 100);

  return (
    <div className="not-prose">
      {/* Age */}
      <div className="mb-5">
        <div className="flex justify-between items-baseline mb-1.5">
          <label
            htmlFor="millionaire-age"
            className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]"
          >
            Your age
          </label>
          <span className="font-mono text-base font-semibold text-gray-900 dark:text-white">{age}</span>
        </div>
        <input
          id="millionaire-age"
          type="range"
          min={AGE_MIN}
          max={AGE_MAX}
          step={1}
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          className="peak-slider w-full"
          style={sliderStyle}
        />
        <div className="mt-1 flex justify-between text-[11px] text-gray-400 dark:text-[#6b6b6b]">
          <span>18</span>
          <span>100</span>
        </div>
      </div>

      {/* Scorecard: one row per yardstick, click to toggle its line */}
      <div className="mb-6">
        <div className="mb-2 text-sm text-gray-700 dark:text-[#cccccc]">
          You turned 18 in <span className="font-mono font-semibold">{year}</span>. To be as rich today as a{' '}
          {year} millionaire, you need enough that it&hellip;
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-[#303031] divide-y divide-gray-100 dark:divide-[#252528] bg-white dark:bg-[#141418]">
          {YARDSTICKS.map((y) => {
            const v = row[y.key];
            const off = hidden.has(y.key);
            return (
              <button
                key={y.key}
                type="button"
                onClick={() => toggle(y.key)}
                aria-pressed={!off}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-opacity ${off ? 'opacity-40' : ''}`}
              >
                <span className="shrink-0 w-1.5 h-8 rounded" style={{ background: color(y) }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-[#e4e4e4]">{y.label}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-[#8a8a8a]">
                    {y.key === 'rank' && row.millionaireShare != null
                      ? `$1M was the top ${pct(row.millionaireShare)} in ${year}; today ${pct(LATEST_SHARE)} of households have it`
                      : y.measures}
                  </span>
                  {v != null && (
                    <span className="mt-1 block h-1 rounded bg-gray-100 dark:bg-[#252528]">
                      <span
                        className="block h-1 rounded"
                        style={{ width: `${barPct(v)}%`, background: color(y) }}
                      />
                    </span>
                  )}
                </span>
                <span className="shrink-0 w-20 text-right font-mono tabular-nums leading-tight">
                  {v != null ? (
                    <span className="text-lg font-bold" style={{ color: color(y) }}>
                      {millions(v)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-[#6b6b6b]">
                      no data before {FIRST_YEAR[y.key]}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div ref={wrapRef} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Dollars needed today to match $1 million at age 18, by current age and yardstick"
          className="block cursor-crosshair"
          onMouseMove={(ev) => setHoverAge(ageAt(ev))}
          onMouseLeave={() => setHoverAge(null)}
          onClick={(ev) => {
            const a = ageAt(ev);
            if (a != null) setAge(a);
          }}
        >
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={pad.left}
                y1={sy(t)}
                x2={pad.left + pw}
                y2={sy(t)}
                stroke={t === 1 ? c.axis : c.grid}
                strokeDasharray={t === 1 ? '3,3' : undefined}
                strokeWidth={1}
              />
              <text x={pad.left - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill={c.text} fontFamily="monospace">
                ${t}M
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={height - 24} textAnchor="middle" fontSize={10} fill={c.text} fontFamily="monospace">
              {t}
            </text>
          ))}

          {visible.map((y) => (
            <path
              key={y.key}
              d={pathFor(y.key)}
              fill="none"
              stroke={color(y)}
              strokeWidth={y.key === 'rank' ? 3 : 2}
              strokeLinejoin="round"
            />
          ))}

          {/* selected age */}
          <line x1={sx(age)} y1={pad.top} x2={sx(age)} y2={pad.top + ph} stroke={c.axis} strokeDasharray="4,4" />
          {visible.map((y) =>
            row[y.key] != null ? (
              <circle key={y.key} cx={sx(age)} cy={sy(row[y.key]!)} r={4} fill={color(y)} stroke={c.bg} strokeWidth={1.5} />
            ) : null,
          )}
          <text
            x={Math.max(pad.left + 24, Math.min(pad.left + pw - 24, sx(age)))}
            y={pad.top - 10}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill={c.text}
            fontFamily="monospace"
          >
            age {age}
          </text>

          <line x1={pad.left} y1={pad.top + ph} x2={pad.left + pw} y2={pad.top + ph} stroke={c.axis} strokeWidth={1} />
          <text x={pad.left + pw / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={c.text}>
            Your age today
          </text>
          <text
            x={14}
            y={pad.top + ph / 2}
            textAnchor="middle"
            fontSize={10}
            fill={c.text}
            transform={`rotate(-90 14 ${pad.top + ph / 2})`}
          >
            Today&apos;s $1M equivalent (log scale)
          </text>

          {hover && hoverAge != null && (
            <g pointerEvents="none">
              <line x1={hoverX} y1={pad.top} x2={hoverX} y2={pad.top + ph} stroke={c.axis} strokeDasharray="2,2" opacity={0.6} />
              {tipRows.map((y) => (
                <circle key={y.key} cx={hoverX} cy={sy(hover[y.key]!)} r={3} fill={color(y)} stroke={c.bg} strokeWidth={1.25} />
              ))}
              <g transform={`translate(${tipX}, ${pad.top + 4})`}>
                <rect width={tipW} height={tipH} rx={5} fill={c.bg} stroke={c.grid} strokeWidth={1} />
                <text x={8} y={15} fontSize={10} fill={c.text} fontFamily="monospace">
                  age {hoverAge} · 18 in {hover.year}
                </text>
                {tipRows.map((y, i) => (
                  <text key={y.key} x={8} y={30 + i * 14} fontSize={10.5} fill={color(y)} fontFamily="monospace">
                    <tspan fontWeight={700}>{millions(hover[y.key]!)}</tspan> {y.label.toLowerCase()}
                  </text>
                ))}
              </g>
            </g>
          )}
        </svg>
        <div className="mt-2 text-[11px] text-gray-400 dark:text-[#6b6b6b]">
          Click a row to hide or show its line · click the chart to pick an age
        </div>
      </div>
    </div>
  );
}
