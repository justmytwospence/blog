'use client';

/**
 * Tiny Zustand store for bidirectional map <-> chart hover sync.
 *
 * A hovered point is `(day, index)`, not a bare index. On a multi-day report the map draws one
 * polyline per day and the elevation chart one dataset per day, so "index 40" names a different
 * place on each of them — a flat index silently linked the wrong points together. A single-day
 * report is just the one-day case (`day: 0`).
 *
 * Chart components subscribe imperatively (store.subscribe) to avoid re-rendering on every
 * mousemove; the maps' hover marker subscribes reactively. Only one report mounts at a time, so a
 * single module store is sufficient (the HoverReset component clears it on report mount/unmount).
 */
import { create } from 'zustand';

export interface HoverPoint {
  /** Index into the report's `days` array — always 0 for a single-day report. */
  day: number;
  /** Index into that day's parallel track arrays (coordinates / distance / altitude). */
  index: number;
}

interface HoverState {
  hover: HoverPoint | null;
  setHover: (p: HoverPoint | null) => void;
}

const samePoint = (a: HoverPoint | null, b: HoverPoint | null): boolean =>
  a === b || (a !== null && b !== null && a.day === b.day && a.index === b.index);

export const useHoverStore = create<HoverState>((set) => ({
  hover: null,
  // Identity-stable on a no-op: mousemove fires far more often than the nearest point actually
  // changes, and every real state write re-renders the map's marker.
  setHover: (p) => set((s) => (samePoint(s.hover, p) ? s : { hover: p })),
}));
