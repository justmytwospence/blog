'use client';

import { type ChartOptions, type ScriptableLineSegmentContext } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { dayColor } from './mapStyle';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { AdventureDay } from '@/lib/adventures';

/** Combined elevation profile across all days: continuous cumulative distance, colored by day. */
export function TripElevation({ days }: { days: AdventureDay[] }) {
  const dark = useIsDark();

  const points: Array<{ x: number; y: number }> = [];
  const dayIdx: number[] = [];
  let cumulative = 0;
  for (let di = 0; di < days.length; di++) {
    const t = days[di].activity.track;
    if (t && t.altitude && t.altitude.length >= 2) {
      for (let i = 0; i < t.altitude.length; i++) {
        points.push({ x: metersToMiles(cumulative + (t.distance[i] ?? 0)), y: metersToFeet(t.altitude[i]) });
        dayIdx.push(di);
      }
    }
    cumulative += days[di].activity.stats.distanceMeters;
  }
  if (points.length < 2) return null;

  const tick = chartTick(dark);
  const grid = chartGrid(dark);

  const data = {
    datasets: [
      {
        label: 'Elevation',
        data: points,
        borderWidth: 2,
        fill: 'start' as const,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        borderColor: '#2563eb',
        segment: {
          borderColor: (ctx: ScriptableLineSegmentContext) => dayColor(dayIdx[ctx.p0DataIndex] ?? 0),
          backgroundColor: (ctx: ScriptableLineSegmentContext) => `${dayColor(dayIdx[ctx.p0DataIndex] ?? 0)}22`,
        },
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `${Number(items[0].parsed.x).toFixed(1)} mi`,
          label: (item) =>
            `${Math.round(Number(item.parsed.y)).toLocaleString()} ft · Day ${(dayIdx[item.dataIndex] ?? 0) + 1}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
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

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Elevation</h2>
      <div className="relative h-56 w-full sm:h-64">
        <Line data={data} options={options} />
      </div>
    </section>
  );
}
