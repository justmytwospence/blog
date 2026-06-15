'use client';

/**
 * Tiny Zustand store for bidirectional map <-> chart hover sync.
 * `hoverIndex` is the index into a report's track arrays (-1 = none). Chart components
 * subscribe imperatively (store.subscribe) to avoid re-rendering on every mousemove; the
 * map's hover marker subscribes reactively. Only one report mounts at a time, so a single
 * module store is sufficient (the HoverReset component clears it on report mount/unmount).
 */
import { create } from 'zustand';

interface HoverState {
  hoverIndex: number;
  setHoverIndex: (i: number) => void;
}

export const useHoverStore = create<HoverState>((set) => ({
  hoverIndex: -1,
  setHoverIndex: (i) => set((s) => (s.hoverIndex === i ? s : { hoverIndex: i })),
}));
