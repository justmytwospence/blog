'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import type { AdventureTrack, ResolvedPhoto } from '@/lib/adventures';
import type { RouteColorMetric } from './mapStyle';
import { downloadGpx } from './gpx';

// Leaflet touches `window`, so the actual map is client-only (mirrors components/concepts/index.ts).
const RouteMapInner = dynamic(() => import('./RouteMapInner').then((m) => m.RouteMapInner), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
});

const METRIC_LABEL: Record<RouteColorMetric, string> = { grade: 'Grade', speed: 'Speed', hr: 'HR' };

export function RouteMap({
  track,
  photos = [],
  title,
}: {
  track: AdventureTrack;
  photos?: ResolvedPhoto[];
  title: string;
}) {
  const [metric, setMetric] = useState<RouteColorMetric>('grade');
  const [full, setFull] = useState(false);

  if (!track || track.coordinates.length < 2) return null;

  const available: RouteColorMetric[] = [];
  if (track.grade?.length) available.push('grade');
  if (track.velocity?.length) available.push('speed');
  if (track.heartrate?.length) available.push('hr');
  const effective: RouteColorMetric = available.includes(metric) ? metric : available[0] ?? 'grade';

  const iconBtn =
    'rounded bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white dark:bg-[#252526]/90 dark:text-[#cccccc] dark:hover:bg-[#252526]';

  return (
    <div className={full ? 'fixed inset-0 z-[2000] bg-white p-3 dark:bg-[#1e1e1e]' : 'relative'}>
      <div
        role="group"
        aria-label={`Route map for ${title}`}
        // `isolate` is load-bearing: the overlay controls below are siblings of the Leaflet
        // container, so the `.leaflet-container` isolation in globals.css does not cover them.
        // Without a stacking context here their z-[1000] resolves against the root and paints
        // over the sticky navbar (z-50) as the page scrolls.
        className={`relative isolate overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031] ${
          full ? 'h-full' : 'aspect-[4/5] sm:aspect-[16/9]'
        }`}
      >
        <RouteMapInner track={track} photos={photos} colorMetric={effective} full={full} />

        <div className="absolute right-2 top-2 z-[1000] flex items-center gap-1">
          {available.length > 1 && (
            <div className="flex overflow-hidden rounded shadow">
              {available.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  aria-pressed={effective === m}
                  className={`px-2 py-1 text-xs font-medium ${
                    effective === m
                      ? 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]'
                      : 'bg-white/90 text-gray-700 dark:bg-[#252526]/90 dark:text-[#cccccc]'
                  }`}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={iconBtn} title="Download GPX" aria-label="Download GPX" onClick={() => downloadGpx(track, title)}>
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            title={full ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => setFull((f) => !f)}
          >
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="absolute bottom-2 left-2 z-[1000] rounded bg-white/85 px-2 py-1 text-[11px] text-gray-600 shadow dark:bg-[#252526]/85 dark:text-[#a6a6a6]">
          Route by {METRIC_LABEL[effective].toLowerCase()}
        </div>
      </div>
    </div>
  );
}
