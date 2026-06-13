'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import type { AdventureDay, AdventureTrack, ResolvedPhoto } from '@/lib/adventures';
import { downloadGpxMulti } from './gpx';

const TripMapInner = dynamic(() => import('./TripMapInner').then((m) => m.TripMapInner), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
});

export function TripMap({
  days,
  photos = [],
  title,
}: {
  days: AdventureDay[];
  photos?: ResolvedPhoto[];
  title: string;
}) {
  const [full, setFull] = useState(false);
  const tracks = days
    .map((d) => d.activity.track)
    .filter((t): t is AdventureTrack => Boolean(t) && (t as AdventureTrack).coordinates.length > 1);
  if (tracks.length === 0) return null;

  const iconBtn =
    'rounded bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white dark:bg-[#252526]/90 dark:text-[#cccccc] dark:hover:bg-[#252526]';

  return (
    <div className={full ? 'fixed inset-0 z-[2000] bg-white p-3 dark:bg-[#1e1e1e]' : 'relative'}>
      <div
        role="group"
        aria-label={`Route map for ${title}`}
        className={`relative overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031] ${
          full ? 'h-full' : 'aspect-[4/5] sm:aspect-[16/9]'
        }`}
      >
        <TripMapInner days={days} photos={photos} />
        <div className="absolute right-2 top-2 z-[1000] flex items-center gap-1">
          <button type="button" className={iconBtn} title="Download GPX" aria-label="Download GPX" onClick={() => downloadGpxMulti(tracks, title)}>
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
          Color = day
        </div>
      </div>
    </div>
  );
}
