'use client';

import { useMemo, useState } from 'react';
import { type ChartOptions, type ScriptableLineSegmentContext, type Plugin } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { dayColor, gradeColor } from './mapStyle';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { AdventureDay } from '@/lib/adventures';

type ColorMode = 'day' | 'grade';

/** Combined elevation profile across all days (or legs): continuous cumulative distance, colored per day or by grade. */
export function TripElevation({ days, unit = 'day' }: { days: AdventureDay[]; unit?: 'day' | 'leg' }) {
  const dark = useIsDark();
  const [mode, setMode] = useState<ColorMode>('day');
  const label = unit === 'leg' ? 'Leg' : 'Day';

  // One entry per day with its points, grade, and start position. Advance the cumulative distance by
  // the TRACK's end (not the activity total) so consecutive days are contiguous — bridging across that
  // gap is what produced the triangular fills.
  const { perDay, boundaries, maxX } = useMemo(() => {
    const out: Array<{ di: number; data: Array<{ x: number; y: number }>; grade: number[] }> = [];
    const bounds: number[] = [];
    let cumulative = 0;
    for (let di = 0; di < days.length; di++) {
      const t = days[di].activity.track;
      if (t && t.altitude && t.altitude.length >= 2) {
        bounds.push(metersToMiles(cumulative));
        const data: Array<{ x: number; y: number }> = [];
        const grade: number[] = [];
        for (let i = 0; i < t.altitude.length; i++) {
          data.push({ x: metersToMiles(cumulative + (t.distance[i] ?? 0)), y: metersToFeet(t.altitude[i]) });
          grade.push(t.grade?.[i] ?? 0);
        }
        out.push({ di, data, grade });
        cumulative += t.distance[t.distance.length - 1] ?? days[di].activity.stats.distanceMeters;
      } else {
        cumulative += days[di].activity.stats.distanceMeters;
      }
    }
    const last = out[out.length - 1];
    return { perDay: out, boundaries: bounds, maxX: last ? last.data[last.data.length - 1]?.x : undefined };
  }, [days]);
  if (perDay.length === 0) return null;

  const tick = chartTick(dark);
  const grid = chartGrid(dark);

  const datasets = perDay.map((d) => {
    const color = dayColor(d.di);
    return {
      label: `${label} ${d.di + 1}`,
      data: d.data,
      borderColor: mode === 'grade' ? '#2563eb' : color,
      backgroundColor: mode === 'grade' ? 'rgba(37,99,235,0.12)' : `${color}22`,
      borderWidth: 2,
      fill: 'start' as const,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      ...(mode === 'grade'
        ? {
            segment: {
              borderColor: (ctx: ScriptableLineSegmentContext) => gradeColor(d.grade[ctx.p0DataIndex] ?? 0),
              backgroundColor: (ctx: ScriptableLineSegmentContext) =>
                gradeColor(d.grade[ctx.p0DataIndex] ?? 0, 0.22),
            },
          }
        : {}),
    };
  });

  // In grade mode the fill no longer shows day boundaries, so draw thin dashed separators.
  const dayBoundaries: Plugin<'line'> = {
    id: 'tripDayBoundaries',
    afterDatasetsDraw(chart) {
      if (mode !== 'grade') return;
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (const mi of boundaries.slice(1)) {
        const x = scales.x.getPixelForValue(mi);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `${Number(items[0].parsed.x).toFixed(1)} mi`,
          label: (item) => {
            const base = `${Math.round(Number(item.parsed.y)).toLocaleString()} ft · ${item.dataset.label ?? ''}`;
            if (mode !== 'grade') return base;
            const g = perDay[item.datasetIndex]?.grade[item.dataIndex];
            return g != null ? `${base} · ${g.toFixed(1)}%` : base;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: maxX,
        title: { display: true, text: 'Distance (mi)', color: tick },
        ticks: { color: tick, maxTicksLimit: 10 },
        grid: { color: grid },
      },
      y: {
        title: { display: true, text: 'Elevation (ft)', color: tick },
        ticks: { color: tick, callback: (v) => Number(v).toLocaleString() },
        grid: { color: grid },
      },
    },
  };

  const btn = (active: boolean) =>
    `px-3 py-1 text-xs font-medium ${
      active
        ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
        : 'bg-white text-gray-600 dark:bg-[#252526] dark:text-[#cccccc]'
    }`;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Elevation</h2>
        <div className="flex overflow-hidden rounded border border-gray-200 dark:border-[#303031]">
          <button type="button" onClick={() => setMode('day')} aria-pressed={mode === 'day'} className={btn(mode === 'day')}>
            {label}
          </button>
          <button type="button" onClick={() => setMode('grade')} aria-pressed={mode === 'grade'} className={btn(mode === 'grade')}>
            Grade
          </button>
        </div>
      </div>
      <div className="relative h-56 w-full sm:h-64">
        <Line data={{ datasets }} options={options} plugins={[dayBoundaries]} />
      </div>
    </section>
  );
}
