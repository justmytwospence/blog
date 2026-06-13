'use client';

import { useRef } from 'react';
import {
  Chart as ChartJS,
  type ChartOptions,
  type ScriptableLineSegmentContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useHoverStore } from './hoverStore';
import { useIsDark, useChartHoverSync, hoverLine, chartGrid, chartTick } from './chartShared';
import { gradeColor } from './mapStyle';
import { metersToMiles, metersToFeet } from '@/lib/units';
import type { AdventureTrack } from '@/lib/adventures';

export function ElevationProfile({ track }: { track: AdventureTrack }) {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const setHoverIndex = useHoverStore((s) => s.setHoverIndex);
  const dark = useIsDark();

  useChartHoverSync(chartRef);

  if (!track.altitude || track.altitude.length < 2) return null;

  const tick = chartTick(dark);
  const grid = chartGrid(dark);
  const points = track.altitude.map((alt, i) => ({
    x: metersToMiles(track.distance[i] ?? 0),
    y: metersToFeet(alt),
  }));
  const hasGrade = Array.isArray(track.grade) && track.grade.length === track.altitude.length;

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
        borderColor: hasGrade ? '#2563eb' : '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.12)',
        segment: hasGrade
          ? {
              borderColor: (ctx: ScriptableLineSegmentContext) =>
                gradeColor(track.grade[ctx.p0DataIndex] ?? 0),
              backgroundColor: (ctx: ScriptableLineSegmentContext) =>
                gradeColor(track.grade[ctx.p0DataIndex] ?? 0, 0.22),
            }
          : undefined,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    onHover: (_e, elements) => setHoverIndex(elements.length ? elements[0].index : -1),
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `${Number(items[0].parsed.x).toFixed(1)} mi`,
          label: (item) => {
            const ele = `${Math.round(Number(item.parsed.y)).toLocaleString()} ft`;
            const grade = hasGrade ? track.grade[item.dataIndex] : null;
            return grade != null ? `${ele} · ${grade.toFixed(1)}% grade` : ele;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Distance (mi)', color: tick },
        ticks: { color: tick, maxTicksLimit: 8 },
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
      <div className="relative h-56 w-full sm:h-64" onMouseLeave={() => setHoverIndex(-1)}>
        <Line ref={chartRef} data={data} options={options} plugins={[hoverLine]} />
      </div>
    </section>
  );
}
