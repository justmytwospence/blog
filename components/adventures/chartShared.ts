'use client';

/** Shared Chart.js setup for the report charts: registration, dark-mode hook, hover sync + cursor. */
import { type RefObject, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { useHoverStore } from './hoverStore';

ChartJS.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

export function useIsDark(): boolean {
  // Initialize synchronously on the client so the first canvas paint already matches the theme.
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export const chartGrid = (dark: boolean): string =>
  dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
export const chartTick = (dark: boolean): string => (dark ? '#8b8b8b' : '#6b7280');

/** Vertical dashed cursor at the shared hover index (read at paint time). */
export const hoverLine: Plugin<'line'> = {
  id: 'adventureHoverLine',
  afterDatasetsDraw(chart) {
    const idx = useHoverStore.getState().hoverIndex;
    if (idx < 0) return;
    const pt = chart.getDatasetMeta(0).data[idx];
    if (!pt) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pt.x, chartArea.top);
    ctx.lineTo(pt.x, chartArea.bottom);
    ctx.strokeStyle = 'rgba(37,99,235,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Redraw this chart's hover cursor when the shared index changes from ELSEWHERE.
 * Skips self-originated changes (where the chart's own active element already matches),
 * so a chart never runs a redundant Chart.update() in response to its own onHover.
 */
export function useChartHoverSync(chartRef: RefObject<ChartJS<'line'> | null>): void {
  useEffect(
    () =>
      useHoverStore.subscribe((s) => {
        const chart = chartRef.current;
        if (!chart) return;
        const active = chart.getActiveElements();
        if (active.length > 0 && active[0].index === s.hoverIndex) return;
        chart.update('none');
      }),
    [chartRef],
  );
}
