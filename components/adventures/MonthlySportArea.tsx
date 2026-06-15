'use client';

import { useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, Legend, Filler, Tooltip, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { sportColor } from './mapStyle';
import { sportMeta } from './sportMeta';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { YearSportTotals } from '@/lib/adventures';

ChartJS.register(CategoryScale, Legend, Filler, Tooltip);

type Metric = 'distance' | 'elevation' | 'duration';
type Bucket = { distanceMeters: number; elevationGainMeters: number; movingTimeSeconds: number };
const OTHER = '#9ca3af';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlySportArea({ data }: { data: YearSportTotals }) {
  const dark = useIsDark();
  const [metric, setMetric] = useState<Metric>('duration');

  // Continuous month axis (fill gaps with zeros so the seasonal waves read clearly). The early years
  // are sparse, so the chart starts at 2023.
  const START = '2023-01';
  const months = useMemo(() => {
    const keys = Object.keys(data)
      .filter((k) => k >= START)
      .sort();
    if (keys.length === 0) return [];
    const [, m1] = keys[keys.length - 1].split('-').map(Number);
    const y1 = Number(keys[keys.length - 1].slice(0, 4));
    const out: string[] = [];
    let y = 2023;
    let m = 1;
    while (y < y1 || (y === y1 && m <= m1)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  }, [data]);

  const sports = useMemo(() => {
    const tot: Record<string, number> = {};
    for (const [ym, mo] of Object.entries(data)) {
      if (ym < START) continue;
      for (const [sp, t] of Object.entries(mo)) tot[sp] = (tot[sp] ?? 0) + t.distanceMeters;
    }
    return Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
  }, [data]);

  if (months.length === 0) return null;

  const TOP = sports.slice(0, 7);
  const tail = new Set(sports.slice(7));
  const val = (t?: Bucket) =>
    !t ? 0 : metric === 'distance' ? metersToMiles(t.distanceMeters) : metric === 'elevation' ? metersToFeet(t.elevationGainMeters) : t.movingTimeSeconds / 3600;

  const series = (sp: string) => ({
    label: sportMeta(sp).label,
    data: months.map((mo) => val(data[mo]?.[sp])),
    borderColor: sportColor(sp),
    backgroundColor: `${sportColor(sp)}cc`,
    fill: true,
    stack: 'all',
    pointRadius: 0,
    pointHoverRadius: 0,
    borderWidth: 1,
    tension: 0.3,
  });
  const datasets = [
    ...TOP.map(series),
    ...(tail.size
      ? [
          {
            label: 'Other',
            data: months.map((mo) => Object.entries(data[mo] ?? {}).filter(([sp]) => tail.has(sp)).reduce((s, [, t]) => s + val(t), 0)),
            borderColor: OTHER,
            backgroundColor: `${OTHER}cc`,
            fill: true,
            stack: 'all',
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 1,
            tension: 0.3,
          },
        ]
      : []),
  ];

  const tick = chartTick(dark);
  const grid = chartGrid(dark);
  const unit = metric === 'distance' ? 'mi' : metric === 'elevation' ? 'ft' : 'h';
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: tick, boxWidth: 12, boxHeight: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: (items) => {
            const [y, m] = months[items[0].dataIndex].split('-').map(Number);
            return `${MONTHS[m - 1]} ${y}`;
          },
          label: (i) => `${i.dataset.label}: ${Math.round(Number(i.parsed.y)).toLocaleString()} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: tick,
          autoSkip: false,
          maxRotation: 0,
          // Label only January of each year.
          callback: (_v, i) => (months[i]?.endsWith('-01') ? months[i].slice(0, 4) : ''),
        },
        grid: { color: grid },
      },
      y: {
        stacked: true,
        ticks: { color: tick, callback: (v) => Number(v).toLocaleString() },
        grid: { color: grid },
        title: { display: true, text: metric === 'distance' ? 'Distance / mo (mi)' : metric === 'elevation' ? 'Elevation / mo (ft)' : 'Time / mo (h)', color: tick },
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Monthly volume by sport</h2>
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
        <Line data={{ labels: months, datasets }} options={options} />
      </div>
    </section>
  );
}
