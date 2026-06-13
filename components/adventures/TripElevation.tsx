'use client';

import { useMemo } from 'react';
import { type ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import { dayColor } from './mapStyle';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { AdventureDay } from '@/lib/adventures';

/** Combined elevation profile across all days: continuous cumulative distance, colored by day. */
export function TripElevation({ days }: { days: AdventureDay[] }) {
  const dark = useIsDark();

  // One dataset per day. Each day fills its own x-range down to the baseline, so there are
  // no cross-day connecting segments — those are what produced the triangular fill wedges.
  const datasets = useMemo(() => {
    const out: Array<{
      label: string;
      data: Array<{ x: number; y: number }>;
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      fill: 'start';
      pointRadius: number;
      pointHoverRadius: number;
      tension: number;
    }> = [];
    let cumulative = 0;
    for (let di = 0; di < days.length; di++) {
      const t = days[di].activity.track;
      if (t && t.altitude && t.altitude.length >= 2) {
        const data: Array<{ x: number; y: number }> = [];
        // Bridge to the previous day's final point so adjacent fills meet with no seam.
        const prev = out[out.length - 1];
        if (prev && prev.data.length) data.push(prev.data[prev.data.length - 1]);
        for (let i = 0; i < t.altitude.length; i++) {
          data.push({ x: metersToMiles(cumulative + (t.distance[i] ?? 0)), y: metersToFeet(t.altitude[i]) });
        }
        const color = dayColor(di);
        out.push({
          label: `Day ${di + 1}`,
          data,
          borderColor: color,
          backgroundColor: `${color}22`,
          borderWidth: 2,
          fill: 'start',
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
        });
      }
      cumulative += days[di].activity.stats.distanceMeters;
    }
    return out;
  }, [days]);
  if (datasets.length === 0) return null;

  const tick = chartTick(dark);
  const grid = chartGrid(dark);

  const data = { datasets };

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
          label: (item) =>
            `${Math.round(Number(item.parsed.y)).toLocaleString()} ft · ${item.dataset.label ?? ''}`,
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
