'use client';

import { useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useHoverStore } from './hoverStore';
import {
  useIsDark,
  useChartHoverSync,
  reportChartHover,
  hoverLine,
  chartGrid,
  chartTick,
} from './chartShared';
import { metersToMiles } from '@/lib/units';
import type { AdventureTrack } from '@/lib/adventures';

type Metric = 'hr' | 'speed';
const MPH_PER_MS = 2.2369362921;

const META: Record<Metric, { label: string; color: string }> = {
  hr: { label: 'Heart rate (bpm)', color: '#dc2626' },
  speed: { label: 'Speed (mph)', color: '#2563eb' },
};

export function MetricCharts({ track, showHeartRate = false }: { track: AdventureTrack; showHeartRate?: boolean }) {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const setHover = useHoverStore((s) => s.setHover);
  const dark = useIsDark();
  const [metric, setMetric] = useState<Metric>('speed');

  useChartHoverSync(chartRef);

  const n = track.distance.length;
  const available = useMemo<Metric[]>(() => {
    const a: Metric[] = [];
    // Heart rate is opt-in (races) — hidden by default even when the data exists.
    if (showHeartRate && track.heartrate?.length === n && n > 0) a.push('hr');
    if (track.velocity?.length === n && n > 0) a.push('speed');
    return a;
  }, [track, n, showHeartRate]);

  if (available.length === 0) return null;
  const effective: Metric = available.includes(metric) ? metric : available[0];

  const tick = chartTick(dark);
  const grid = chartGrid(dark);
  const values = effective === 'hr' ? track.heartrate : track.velocity.map((v) => v * MPH_PER_MS);
  const points = values.map((y, i) => ({ x: metersToMiles(track.distance[i] ?? 0), y }));

  const data = {
    datasets: [
      {
        label: META[effective].label,
        // A single-day report is day 0; the shared hover cursor resolves datasets by this tag.
        dayIndex: 0,
        data: points,
        borderColor: META[effective].color,
        backgroundColor: `${META[effective].color}22`,
        borderWidth: 2,
        fill: 'start' as const,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    onHover: (_e, elements) => reportChartHover(elements, () => 0),
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `${Number(items[0].parsed.x).toFixed(1)} mi`,
          label: (item) =>
            `${Math.round(Number(item.parsed.y)).toLocaleString()} ${effective === 'hr' ? 'bpm' : 'mph'}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: points[points.length - 1]?.x,
        title: { display: true, text: 'Distance (mi)', color: tick },
        ticks: { color: tick, maxTicksLimit: 8 },
        grid: { color: grid },
      },
      y: {
        ticks: { color: tick },
        grid: { color: grid },
      },
    },
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">{META[effective].label}</h2>
        {available.length > 1 && (
          <div className="flex overflow-hidden rounded border border-gray-200 dark:border-[#303031]">
            {available.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={effective === m}
                className={`px-3 py-1 text-xs font-medium ${
                  effective === m
                    ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
                    : 'bg-white text-gray-600 dark:bg-[#252526] dark:text-[#cccccc]'
                }`}
              >
                {m === 'hr' ? 'HR' : 'Speed'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative h-48 w-full" onMouseLeave={() => setHover(null)}>
        <Line ref={chartRef} data={data} options={options} plugins={[hoverLine]} />
      </div>
    </section>
  );
}
