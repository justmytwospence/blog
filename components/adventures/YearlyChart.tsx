'use client';

import { useState } from 'react';
import { Chart as ChartJS, Legend, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { YearlyTotals } from '@/lib/adventures';

ChartJS.register(Legend);

type Metric = 'distance' | 'elevation' | 'duration';

// Month-start day-of-year for x-axis ticks.
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Recent years get vivid colors; older years recede.
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export function YearlyChart({ totals }: { totals: YearlyTotals }) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<Metric>('distance');

  // Only years with substantial logged volume (drops sparse early years like 2020-2021).
  const years = Object.entries(totals.years)
    .filter(([, pts]) => pts.length >= 50)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  if (years.length === 0) return null;

  const tick = chartTick(dark);
  const grid = chartGrid(dark);
  const convert = (p: { distM: number; gainM: number; timeS: number }) =>
    metric === 'distance' ? metersToMiles(p.distM) : metric === 'elevation' ? metersToFeet(p.gainM) : p.timeS / 3600;

  const datasets = years.map(([year, pts], i) => {
    // newest year last in the sorted list → give it the lead color and a heavier line
    const recencyFromNewest = years.length - 1 - i;
    const color = PALETTE[recencyFromNewest % PALETTE.length];
    return {
      label: year,
      data: pts.map((p) => ({ x: p.doy, y: convert(p) })),
      borderColor: color,
      backgroundColor: color,
      borderWidth: recencyFromNewest === 0 ? 2.5 : 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.1,
    };
  });

  const unit = metric === 'distance' ? 'mi' : metric === 'elevation' ? 'ft' : 'h';
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: tick, boxWidth: 12, boxHeight: 2, usePointStyle: false } },
      tooltip: {
        callbacks: {
          title: (items) => {
            const doy = Number(items[0].parsed.x);
            const mi = MONTH_STARTS.filter((s) => s <= doy).length - 1;
            return `${MONTHS[Math.max(0, mi)]} ${doy - MONTH_STARTS[Math.max(0, mi)] + 1}`;
          },
          label: (item) =>
            `${item.dataset.label}: ${Math.round(Number(item.parsed.y)).toLocaleString()} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: 1,
        max: 366,
        afterBuildTicks: (axis) => {
          axis.ticks = MONTH_STARTS.map((value) => ({ value }));
        },
        ticks: { color: tick, callback: (v) => MONTHS[MONTH_STARTS.indexOf(Number(v))] ?? '' },
        grid: { color: grid },
      },
      y: {
        title: {
          display: true,
          text:
            metric === 'distance'
              ? 'Cumulative distance (mi)'
              : metric === 'elevation'
                ? 'Cumulative gain (ft)'
                : 'Cumulative time (h)',
          color: tick,
        },
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
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Year over year</h2>
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
      <div className="relative h-64 w-full">
        <Line data={{ datasets }} options={options} />
      </div>
    </section>
  );
}
