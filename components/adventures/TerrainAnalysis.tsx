'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  PolarAreaController,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, PolarArea } from 'react-chartjs-2';
import { useIsDark, chartGrid, chartTick } from './chartShared';
import type { AdventureTrack } from '@/lib/adventures';

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, PolarAreaController, RadialLinearScale, ArcElement, Tooltip);

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ASPECT_COLORS = ['#2563eb', '#0891b2', '#16a34a', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed'];

const GRADE_EDGES = [-100, -20, -15, -10, -5, 0, 5, 10, 15, 20, 100];
const GRADE_LABELS = ['<-20', '-20', '-15', '-10', '-5', '0–5', '5–10', '10–15', '15–20', '>20'];

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const p1 = lat1 * r;
  const p2 = lat2 * r;
  const dl = (lng2 - lng1) * r;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

export function TerrainAnalysis({ track }: { track: AdventureTrack }) {
  const dark = useIsDark();
  const tick = chartTick(dark);
  const grid = chartGrid(dark);

  const { gradePct, aspect, totalDist } = useMemo(() => {
    const coords = track.coordinates;
    const dist = track.distance;
    const grade = track.grade;
    const hasGrade = Array.isArray(grade) && grade.length === coords.length;
    const gradeBins = new Array(GRADE_LABELS.length).fill(0);
    const aspectBins = new Array(8).fill(0);
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const seg = Math.max(0, (dist[i + 1] ?? 0) - (dist[i] ?? 0));
      total += seg;
      if (hasGrade) {
        const g = grade[i];
        let b = GRADE_EDGES.findIndex((e, k) => g >= e && g < GRADE_EDGES[k + 1]);
        if (b < 0) b = g >= 20 ? GRADE_LABELS.length - 1 : 0;
        gradeBins[b] += seg;
      }
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      aspectBins[Math.round(bearingDeg(lat1, lng1, lat2, lng2) / 45) % 8] += seg;
    }
    const pct = (arr: number[]) => arr.map((v) => (total > 0 ? (v / total) * 100 : 0));
    return { gradePct: hasGrade ? pct(gradeBins) : null, aspect: pct(aspectBins), totalDist: total };
  }, [track]);

  if (totalDist <= 0) return null;

  const gradeData = {
    labels: GRADE_LABELS,
    datasets: [{ data: gradePct ?? [], backgroundColor: '#2563eb', borderRadius: 2 }],
  };
  const gradeOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (i) => `${Number(i.parsed.y).toFixed(0)}% of distance` } },
    },
    scales: {
      x: { title: { display: true, text: 'Grade (%)', color: tick }, ticks: { color: tick }, grid: { color: grid } },
      y: { ticks: { color: tick, callback: (v) => `${v}%` }, grid: { color: grid } },
    },
  };

  const aspectData = {
    labels: DIRS,
    datasets: [{ data: aspect, backgroundColor: ASPECT_COLORS.map((c) => `${c}cc`), borderWidth: 0 }],
  };
  const aspectOptions: ChartOptions<'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (i) => `${i.label}: ${Number(i.parsed.r).toFixed(0)}%` } },
    },
    scales: {
      r: {
        grid: { color: grid },
        angleLines: { color: grid },
        ticks: { display: false },
        pointLabels: { color: tick, font: { size: 11 } },
      },
    },
  };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Terrain</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {gradePct && (
          <div>
            <h3 className="mb-2 text-sm text-gray-500 dark:text-[#a6a6a6]">Grade distribution</h3>
            <div className="relative h-48">
              <Bar data={gradeData} options={gradeOptions} />
            </div>
          </div>
        )}
        <div>
          <h3 className="mb-2 text-sm text-gray-500 dark:text-[#a6a6a6]">Aspect (direction traveled)</h3>
          <div className="relative h-48">
            <PolarArea data={aspectData} options={aspectOptions} />
          </div>
        </div>
      </div>
    </section>
  );
}
