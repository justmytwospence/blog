'use client';

/** Shared Chart.js setup for the report charts: registration, dark-mode hook, hover sync + cursor. */
import { type RefObject, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  type ActiveElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { useHoverStore, type HoverPoint } from './hoverStore';

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

/**
 * Resolve a hovered `(day, index)` to an element of THIS chart.
 *
 * Charts tag each dataset with the day it plots (`dayIndex`): the trip elevation chart draws one
 * dataset per day and skips days with no track, so dataset order is not day order. Single-series
 * charts tag their one dataset `dayIndex: 0`, which is also the day a single-day report reports.
 * Returns null when the hovered day is not plotted here — the caller then has nothing to draw.
 */
function elementFor(
  chart: ChartJS<'line'>,
  hover: HoverPoint,
): { datasetIndex: number; index: number; x: number } | null {
  const datasetIndex = chart.data.datasets.findIndex(
    (ds) => (ds as { dayIndex?: number }).dayIndex === hover.day,
  );
  if (datasetIndex < 0) return null;
  const pt = chart.getDatasetMeta(datasetIndex).data[hover.index];
  return pt ? { datasetIndex, index: hover.index, x: pt.x } : null;
}

/**
 * True while a chart is being redrawn to follow a hover that arrived from somewhere else.
 *
 * Chart.js replays its last event on every `update()` — "replay last event from the previous update
 * to regenerate the tooltip" — which calls `onHover` again with the chart's own, stale cursor
 * position. A hover arriving from the map makes us call `update()` to draw the cursor, so that
 * replay would immediately write the chart's position back over the map's. The visible symptom is
 * that the map stops driving the charts the moment you have hovered a chart even once. Writes are
 * suppressed for the duration of the redraw, which is synchronous.
 */
let replayingExternalHover = false;

/**
 * Report this chart's hovered element to the shared store — the chart -> map half of the link.
 * `dayFor` maps one of this chart's dataset indices to the day that dataset plots.
 */
export function reportChartHover(
  elements: ActiveElement[],
  dayFor: (datasetIndex: number) => number | undefined,
): void {
  if (replayingExternalHover) return;
  const { setHover } = useHoverStore.getState();
  if (elements.length === 0) {
    setHover(null);
    return;
  }
  const day = dayFor(elements[0].datasetIndex);
  setHover(day == null ? null : { day, index: elements[0].index });
}

/** Vertical dashed cursor at the shared hover point (read at paint time). */
export const hoverLine: Plugin<'line'> = {
  id: 'adventureHoverLine',
  afterDatasetsDraw(chart) {
    const hover = useHoverStore.getState().hover;
    if (!hover) return;
    const pt = elementFor(chart, hover);
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
 * Redraw this chart's hover cursor when the shared point changes from ELSEWHERE.
 * Skips self-originated changes (where the chart's own active element already matches),
 * so a chart never runs a redundant Chart.update() in response to its own onHover.
 */
export function useChartHoverSync(chartRef: RefObject<ChartJS<'line'> | null>): void {
  useEffect(
    () =>
      useHoverStore.subscribe((s) => {
        const chart = chartRef.current;
        if (!chart) return;
        const target = s.hover ? elementFor(chart, s.hover) : null;
        const active = chart.getActiveElements();
        if (
          target &&
          active.length > 0 &&
          active[0].datasetIndex === target.datasetIndex &&
          active[0].index === target.index
        ) {
          return;
        }
        // Still redraws when `target` is null — that is how a cursor drawn for a previous point
        // (or for a day this chart does not plot) gets erased.
        replayingExternalHover = true;
        try {
          chart.update('none');
        } finally {
          replayingExternalHover = false;
        }
      }),
    [chartRef],
  );
}
