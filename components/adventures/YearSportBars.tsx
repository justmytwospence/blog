'use client';

import { useMemo, useState } from 'react';
import { Chart as ChartJS, BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { sportColor } from './mapStyle';
import { sportMeta } from './sportMeta';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { YearSportTotals } from '@/lib/adventures';

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

type Metric = 'distance' | 'elevation' | 'duration';
const OTHER = '#9ca3af';

export function YearSportBars({ data }: { data: YearSportTotals }) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<Metric>('distance');

  const years = useMemo(() => Object.keys(data).filter((y) => Number(y) >= 2019).sort(), [data]);

  // Rank sports by all-time distance; keep the top ones and fold the long tail into "Other".
  const sports = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const y of years) for (const [sp, t] of Object.entries(data[y])) totals[sp] = (totals[sp] ?? 0) + t.distanceMeters;
    return Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  }, [data, years]);

  if (years.length === 0) return null;

  const TOP = sports.slice(0, 8);
  const tail = new Set(sports.slice(8));
  const val = (t: { distanceMeters: number; elevationGainMeters: number; movingTimeSeconds: number }) =>
    metric === 'distance' ? metersToMiles(t.distanceMeters) : metric === 'elevation' ? metersToFeet(t.elevationGainMeters) : t.movingTimeSeconds / 3600;

  const datasets = [
    ...TOP.map((sp) => ({
      label: sportMeta(sp).label,
      data: years.map((y) => (data[y][sp] ? val(data[y][sp]) : 0)),
      backgroundColor: sportColor(sp),
      stack: 'all',
      borderWidth: 0,
    })),
    ...(tail.size
      ? [
          {
            label: 'Other',
            data: years.map((y) =>
              Object.entries(data[y])
                .filter(([sp]) => tail.has(sp))
                .reduce((s, [, t]) => s + val(t), 0),
            ),
            backgroundColor: OTHER,
            stack: 'all',
            borderWidth: 0,
          },
        ]
      : []),
  ];

  const tick = chartTick(dark);
  const grid = chartGrid(dark);
  const unit = metric === 'distance' ? 'mi' : metric === 'elevation' ? 'ft' : 'h';
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: tick, boxWidth: 12, boxHeight: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (i) => `${i.dataset.label}: ${Math.round(Number(i.parsed.y)).toLocaleString()} ${unit}`,
        },
      },
    },
    scales: {
      x: { stacked: true, ticks: { color: tick }, grid: { display: false } },
      y: {
        stacked: true,
        ticks: { color: tick, callback: (v) => Number(v).toLocaleString() },
        grid: { color: grid },
        title: { display: true, text: metric === 'distance' ? 'Distance (mi)' : metric === 'elevation' ? 'Elevation (ft)' : 'Time (h)', color: tick },
      },
    },
  };

  const btn = (active: boolean) =>
    `px-3 py-1 text-xs font-medium ${
      active ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]' : 'bg-white text-gray-600 dark:bg-[#252526] dark:text-[#cccccc]'
    }`;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">By year &amp; sport</h2>
        <div className="flex overflow-hidden rounded border border-gray-200 dark:border-[#303031]">
          <button type="button" onClick={() => setMetric('distance')} aria-pressed={metric === 'distance'} className={btn(metric === 'distance')}>
            Distance
          </button>
          <button type="button" onClick={() => setMetric('elevation')} aria-pressed={metric === 'elevation'} className={btn(metric === 'elevation')}>
            Elevation
          </button>
          <button type="button" onClick={() => setMetric('duration')} aria-pressed={metric === 'duration'} className={btn(metric === 'duration')}>
            Duration
          </button>
        </div>
      </div>
      <div className="relative h-72 w-full">
        <Bar data={{ labels: years, datasets }} options={options} />
      </div>
    </section>
  );
}
