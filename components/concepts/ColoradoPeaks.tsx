'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

const PeaksMap = dynamic(() => import('./PeaksMapInner').then((m) => m.PeaksMapInner), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
});

interface Peak {
  name: string;
  elevationFt: number;
  prominenceFt: number;
  county?: string;
  ydsClass?: string;
  lojId?: number;
  lat?: number;
  lon?: number;
  official: boolean;
}

/** The authoritative per-peak reference. Lists of John has a page for every ranked CO summit. */
function peakUrl(p: Peak): string | undefined {
  return p.lojId ? `https://listsofjohn.com/peak/${p.lojId}` : undefined;
}

const ELEV_MIN = 12000;
const ELEV_MAX = 14440;
const PROM_MAX = 1000;
const CANON_ELEV = 14000; // the official "fourteener" line
const CANON_PROM = 300; // the official 300-ft prominence ("separation") rule

/** Index of the first element >= x in an ascending array (lower bound). */
function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const nf = new Intl.NumberFormat('en-US');

/** A fixed tick under a slider marking the official value, so it's visible as you drag away. */
function CanonTick({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="relative h-4 mt-1 select-none" aria-hidden>
      <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${pct}%` }}>
        <span className="w-px h-1.5 bg-indigo-400 dark:bg-indigo-300" />
        <span className="mt-0.5 text-[9px] leading-none whitespace-nowrap text-indigo-500 dark:text-indigo-300">
          {label}
        </span>
      </div>
    </div>
  );
}

export default function ColoradoPeaks() {
  const [peaks, setPeaks] = useState<Peak[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [elevationThreshold, setElevationThreshold] = useState(14000);
  const [prominenceCutoff, setProminenceCutoff] = useState(300);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);

  useEffect(() => {
    let alive = true;
    fetch('/colorado-peaks.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Peak[]) => {
        if (alive) setPeaks(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ascending elevation arrays, for survival counts via binary search.
  const elevAll = useMemo(
    () => (peaks ? peaks.map((p) => p.elevationFt).sort((a, b) => a - b) : []),
    [peaks],
  );
  const elevQualifying = useMemo(
    () =>
      peaks
        ? peaks
            .filter((p) => p.prominenceFt >= prominenceCutoff)
            .map((p) => p.elevationFt)
            .sort((a, b) => a - b)
        : [],
    [peaks, prominenceCutoff],
  );

  const survAll = (x: number) => elevAll.length - lowerBound(elevAll, x);
  const survQual = (x: number) => elevQualifying.length - lowerBound(elevQualifying, x);

  const qualifyingCount = survQual(elevationThreshold);
  const aboveCount = survAll(elevationThreshold);
  const cutByProminence = aboveCount - qualifyingCount;

  // The official answer (14,000 ft + 300 ft prominence) = 53. Fixed, for comparison as you drag.
  const canonCount = useMemo(
    () =>
      peaks ? peaks.filter((p) => p.elevationFt >= CANON_ELEV && p.prominenceFt >= CANON_PROM).length : 0,
    [peaks],
  );
  const mappedCount = useMemo(() => (peaks ? peaks.filter((p) => p.lat != null).length : 0), [peaks]);

  // Peaks at or above the threshold, marginal (lowest) first — where the in/out action happens.
  const boundaryPeaks = useMemo(() => {
    if (!peaks) return [];
    return peaks
      .filter((p) => p.elevationFt >= elevationThreshold)
      .sort((a, b) => a.elevationFt - b.elevationFt);
  }, [peaks, elevationThreshold]);
  const LIST_CAP = 60;
  const shownPeaks = boundaryPeaks.slice(0, LIST_CAP);

  // ---- chart geometry ----
  const height = 340;
  const pad = { top: 18, right: 16, bottom: 42, left: 52 };
  const pw = Math.max(10, width - pad.left - pad.right);
  const ph = height - pad.top - pad.bottom;
  const total = elevAll.length || 1;

  const sx = (e: number) => pad.left + ((e - ELEV_MIN) / (ELEV_MAX - ELEV_MIN)) * pw;
  const sy = (count: number) => pad.top + ph - (count / total) * ph;

  // Proper (non-decreasing) CDF: the number of peaks at or below an elevation.
  const cdfAll = (x: number) => lowerBound(elevAll, x);
  const cdfQual = (x: number) => lowerBound(elevQualifying, x);

  const SAMPLES = Math.max(60, Math.round(pw / 3));
  const buildPath = (fn: (x: number) => number) => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const e = ELEV_MIN + (i / SAMPLES) * (ELEV_MAX - ELEV_MIN);
      const x = sx(e);
      const y = sy(fn(e));
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  const pathAll = peaks ? buildPath(cdfAll) : '';
  const pathQual = peaks ? buildPath(cdfQual) : '';

  const c = {
    grid: isDark ? '#26262f' : '#e8e8ee',
    axis: isDark ? '#6b7280' : '#9ca3af',
    text: isDark ? '#a6a6a6' : '#6b7280',
    all: isDark ? '#3f3f5a' : '#cbd5e1',
    qual: isDark ? '#2dd4bf' : '#0d9488',
    marker: isDark ? '#f59e0b' : '#d97706',
    ref: isDark ? '#a5b4fc' : '#6366f1',
  };

  const yTicks = [0, 500, 1000, 1500].filter((t) => t <= total);
  const xTicks = [12000, 12500, 13000, 13500, 14000];

  if (failed) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-[#303031] p-6 text-sm text-gray-500 dark:text-[#a6a6a6]">
        Couldn’t load the peak data. Try refreshing.
      </div>
    );
  }

  return (
    <div className="not-prose">
      {/* Map — spatial view on top; same in/out coloring + links as the list */}
      {peaks && (
        <div className="mb-6">
          <div className="h-[380px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031]">
            <PeaksMap peaks={peaks} elevationThreshold={elevationThreshold} prominenceCutoff={prominenceCutoff} />
          </div>
          <div className="mt-1.5 text-[11px] text-gray-400 dark:text-[#6b6b6b]">
            {nf.format(mappedCount)} of {nf.format(peaks.length)} peaks have mapped coordinates · click any for its Lists of John page · basemap &amp; coordinates © OpenStreetMap
          </div>
        </div>
      )}

      {/* Sliders — directly above the CDF */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">
              Elevation threshold
            </label>
            <span className="font-mono text-base font-semibold text-teal-600 dark:text-teal-400">
              {nf.format(elevationThreshold)}′
            </span>
          </div>
          <input
            type="range"
            min={ELEV_MIN}
            max={ELEV_MAX}
            step={10}
            value={elevationThreshold}
            onChange={(e) => setElevationThreshold(Number(e.target.value))}
            className="w-full accent-teal-500"
            aria-label="Elevation threshold in feet"
          />
          <CanonTick pct={((CANON_ELEV - ELEV_MIN) / (ELEV_MAX - ELEV_MIN)) * 100} label="official 14,000′" />
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">
              Prominence cutoff (separation rule)
            </label>
            <span className="font-mono text-base font-semibold text-amber-600 dark:text-amber-400">
              {nf.format(prominenceCutoff)}′
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={PROM_MAX}
            step={10}
            value={prominenceCutoff}
            onChange={(e) => setProminenceCutoff(Number(e.target.value))}
            className="w-full accent-amber-500"
            aria-label="Prominence cutoff in feet"
          />
          <CanonTick pct={(CANON_PROM / PROM_MAX) * 100} label="official 300′" />
        </div>
      </div>

      {/* CDF — cumulative number of peaks at or below an elevation */}
      <div ref={wrapRef} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Cumulative distribution of Colorado peak elevations"
          className="block"
        >
          {/* y grid + ticks */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={pad.left} y1={sy(t)} x2={pad.left + pw} y2={sy(t)} stroke={c.grid} strokeWidth={1} />
              <text x={pad.left - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill={c.text} fontFamily="monospace">
                {nf.format(t)}
              </text>
            </g>
          ))}
          {/* x ticks */}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={height - 24} textAnchor="middle" fontSize={10} fill={c.text} fontFamily="monospace">
              {(t / 1000).toFixed(1)}k′
            </text>
          ))}
          {/* CDF: all peaks (faint) and those clearing the prominence rule (bold) */}
          {peaks && <path d={pathAll} fill="none" stroke={c.all} strokeWidth={1.5} strokeDasharray="3,3" />}
          {peaks && <path d={pathQual} fill="none" stroke={c.qual} strokeWidth={2.5} />}
          {/* official 14,000′ reference line (fixed, for comparison) */}
          {peaks && (
            <>
              <line x1={sx(CANON_ELEV)} y1={pad.top} x2={sx(CANON_ELEV)} y2={pad.top + ph} stroke={c.ref} strokeWidth={1} opacity={0.85} />
              <text x={sx(CANON_ELEV) - 6} y={pad.top + 10} textAnchor="end" fontSize={9} fill={c.ref} fontFamily="monospace">
                official 14,000′
              </text>
            </>
          )}
          {/* your current elevation cutoff — line + where it meets the curve */}
          {peaks && (
            <>
              <line x1={sx(elevationThreshold)} y1={pad.top} x2={sx(elevationThreshold)} y2={pad.top + ph} stroke={c.marker} strokeWidth={1.5} strokeDasharray="4,3" />
              <circle cx={sx(elevationThreshold)} cy={sy(cdfQual(elevationThreshold))} r={4} fill={c.marker} />
            </>
          )}
          {/* axes */}
          <line x1={pad.left} y1={pad.top + ph} x2={pad.left + pw} y2={pad.top + ph} stroke={c.axis} strokeWidth={1} />
          <text x={pad.left + pw} y={height - 6} textAnchor="end" fontSize={10} fill={c.text}>
            elevation →
          </text>
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500 dark:text-[#8a8a8a]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ background: c.qual }} /> cumulative peaks (clearing the rule)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: c.all }} /> ignoring prominence
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: c.ref }} /> official 14,000′ / 300′
          </span>
        </div>
      </div>

      {/* Headline count — below the chart */}
      <div className="mt-4 text-sm text-gray-700 dark:text-[#cccccc]">
        <span className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
          {peaks ? nf.format(qualifyingCount) : '—'}
        </span>{' '}
        peaks clear <span className="font-mono">{nf.format(elevationThreshold)}′</span> with at least{' '}
        <span className="font-mono">{nf.format(prominenceCutoff)}′</span> of prominence
        {peaks && cutByProminence > 0 && (
          <>
            {' '}
            <span className="text-amber-600 dark:text-amber-400">
              ({nf.format(cutByProminence)} more clear the height but are cut by the separation rule)
            </span>
          </>
        )}
        .{' '}
        {peaks && (
          <span className="text-indigo-500 dark:text-indigo-300">
            The official line (14,000′ / 300′) gives {nf.format(canonCount)}.
          </span>
        )}
      </div>

      {/* Boundary list */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a] mb-2">
          At or above {nf.format(elevationThreshold)}′ — closest to the line first
        </h3>
        <div className="rounded-lg border border-gray-200 dark:border-[#303031] divide-y divide-gray-100 dark:divide-[#252528] max-h-80 overflow-y-auto bg-white dark:bg-[#141418]">
          {!peaks && <div className="p-4 text-sm text-gray-400">Loading {nf.format(0)} peaks…</div>}
          {peaks &&
            shownPeaks.map((p, i) => {
              const qualifies = p.prominenceFt >= prominenceCutoff;
              return (
                <div key={`${p.name}-${p.elevationFt}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className={`shrink-0 w-1.5 h-6 rounded ${qualifies ? 'bg-teal-500' : 'bg-amber-500'}`} />
                  <span className="flex-1">
                    <a
                      href={peakUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className={`${p.official ? '' : 'italic'} text-gray-900 dark:text-[#e4e4e4] hover:text-teal-600 dark:hover:text-teal-400 hover:underline`}
                    >
                      {p.name}
                    </a>
                    {p.county && <span className="text-gray-400 dark:text-[#6b6b6b]"> · {p.county}</span>}
                  </span>
                  <span className="font-mono text-gray-700 dark:text-[#bbb] tabular-nums">{nf.format(p.elevationFt)}′</span>
                  <span className={`font-mono tabular-nums w-20 text-right ${qualifies ? 'text-gray-400 dark:text-[#6b6b6b]' : 'text-amber-600 dark:text-amber-400 font-semibold'}`}>
                    {nf.format(p.prominenceFt)}′ prom
                  </span>
                </div>
              );
            })}
          {peaks && boundaryPeaks.length > LIST_CAP && (
            <div className="px-3 py-2 text-xs text-gray-400 dark:text-[#6b6b6b]">
              + {nf.format(boundaryPeaks.length - LIST_CAP)} more higher up
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
