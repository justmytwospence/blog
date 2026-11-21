'use client';

import { type CSSProperties, type MouseEvent as RMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  coUrl?: string;
  lat?: number;
  lon?: number;
  official: boolean;
}

/** The peak's 14ers.com page (14ers + most 13ers); undefined for peaks not on the site (e.g. 12ers). */
function peakUrl(p: Peak): string | undefined {
  return p.coUrl;
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
function CanonTick({ pct, label, tone }: { pct: number; label: string; tone: 'elev' | 'prom' }) {
  const tick = tone === 'elev' ? 'bg-green-400 dark:bg-green-300' : 'bg-orange-400 dark:bg-orange-300';
  const txt = tone === 'elev' ? 'text-green-600 dark:text-green-300' : 'text-orange-600 dark:text-orange-300';
  return (
    <div className="relative h-4 mt-1 select-none" aria-hidden>
      <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${pct}%` }}>
        <span className={`w-px h-1.5 ${tick}`} />
        <span className={`mt-0.5 text-[9px] leading-none whitespace-nowrap ${txt}`}>{label}</span>
      </div>
    </div>
  );
}

export default function ColoradoPeaks() {
  const [peaks, setPeaks] = useState<Peak[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [elevationThreshold, setElevationThreshold] = useState(14000);
  const [prominenceCutoff, setProminenceCutoff] = useState(300);
  const [hoverE, setHoverE] = useState<number | null>(null);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const trackBg = isDark ? '#3f3f46' : '#e5e7eb';
  const sliderStyle = (accent: string, pct: number): CSSProperties =>
    ({ '--accent': accent, '--track': trackBg, '--pct': `${pct}%` }) as CSSProperties;

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
  // Peaks clearing the OFFICIAL 300-ft rule — the fixed reference curve to compare your cutoff against.
  const elevCanon = useMemo(
    () =>
      peaks
        ? peaks.filter((p) => p.prominenceFt >= CANON_PROM).map((p) => p.elevationFt).sort((a, b) => a - b)
        : [],
    [peaks],
  );

  const survAll = (x: number) => elevAll.length - lowerBound(elevAll, x);
  const survQual = (x: number) => elevQualifying.length - lowerBound(elevQualifying, x);
  const survCanon = (x: number) => elevCanon.length - lowerBound(elevCanon, x);

  const qualifyingCount = survQual(elevationThreshold);
  const aboveCount = survAll(elevationThreshold);
  const cutByProminence = aboveCount - qualifyingCount;

  // The official answer (14,000 ft + 300 ft prominence) = 53. Fixed, for comparison as you drag.
  const canonCount = useMemo(
    () =>
      peaks ? peaks.filter((p) => p.elevationFt >= CANON_ELEV && p.prominenceFt >= CANON_PROM).length : 0,
    [peaks],
  );

  // Peaks passing BOTH thresholds, marginal (lowest) first — rows drop out as either slider moves.
  const boundaryPeaks = useMemo(() => {
    if (!peaks) return [];
    return peaks
      .filter((p) => p.elevationFt >= elevationThreshold && p.prominenceFt >= prominenceCutoff)
      .sort((a, b) => a.elevationFt - b.elevationFt);
  }, [peaks, elevationThreshold, prominenceCutoff]);

  // ---- chart geometry ----
  const height = 340;
  const pad = { top: 18, right: 16, bottom: 42, left: 64 };
  const pw = Math.max(10, width - pad.left - pad.right);
  const ph = height - pad.top - pad.bottom;
  const total = elevAll.length || 1;

  // Reversed elevation axis (high on the left): the curve then rises left -> right as you lower the
  // bar, so the y-value IS the number of peaks at or above that elevation.
  const sx = (e: number) => pad.left + ((ELEV_MAX - e) / (ELEV_MAX - ELEV_MIN)) * pw;
  const sy = (count: number) => pad.top + ph - (count / total) * ph;

  // The "no prominence rule" comparison only appears at the round elevation cutoffs (13k / 14k).
  const atRound = elevationThreshold === 14000 || elevationThreshold === 13000;
  const count300 = survCanon(elevationThreshold); // peaks >= threshold clearing the 300' rule

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
  const pathAll = peaks ? buildPath(survAll) : '';
  const pathCanon = peaks ? buildPath(survCanon) : '';
  const pathQual = peaks ? buildPath(survQual) : '';

  const c = {
    grid: isDark ? '#26262f' : '#e8e8ee',
    axis: isDark ? '#6b7280' : '#9ca3af',
    text: isDark ? '#a6a6a6' : '#6b7280',
    elev: isDark ? '#4ade80' : '#16a34a', // green — the elevation dimension
    prom: isDark ? '#fb923c' : '#ea580c', // orange — the prominence dimension
    gray: isDark ? '#a3a3a3' : '#404040', // neutral — the data curve and everything else
  };

  const yTicks = [0, 500, 1000, 1500].filter((t) => t <= total);
  const xTicks = [12000, 12500, 13000, 13500, 14000];

  // x-axis hover: map the cursor to an elevation (reversed axis) and read the count there.
  const onHoverMove = (ev: RMouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = rect.width ? ((ev.clientX - rect.left) * width) / rect.width : ev.clientX - rect.left;
    if (px < pad.left || px > pad.left + pw) {
      setHoverE(null);
      return;
    }
    setHoverE(ELEV_MAX - ((px - pad.left) / pw) * (ELEV_MAX - ELEV_MIN));
  };
  const hoverX = hoverE != null ? sx(hoverE) : 0;
  const hoverLeft = hoverX < pad.left + pw / 2;
  const hQual = hoverE != null ? survQual(hoverE) : 0; // your cutoff line
  const hCanon = hoverE != null ? survCanon(hoverE) : 0; // official 300' line
  const hAll = hoverE != null ? survAll(hoverE) : 0; // no-prominence line (only at 13k/14k)

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
            Peaks passing both thresholds (those with coordinates) · 14ers and 13ers link to 14ers.com · basemap &amp; coordinates © OpenStreetMap
          </div>
        </div>
      )}

      {/* CDF — cumulative number of peaks at or below an elevation */}
      <div ref={wrapRef} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Number of Colorado peaks at or above an elevation threshold"
          className="block"
          onMouseMove={onHoverMove}
          onMouseLeave={() => setHoverE(null)}
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
          {/* "no prominence rule" envelope — only at the round elevation cutoffs (13k / 14k) */}
          {peaks && atRound && (
            <path d={pathAll} fill="none" stroke={c.gray} strokeWidth={1} strokeDasharray="1.5,3" opacity={0.55} />
          )}
          {/* CDF: your current cutoff (gray solid) + the official 300' rule (orange dashed reference) */}
          {peaks && <path d={pathCanon} fill="none" stroke={c.prom} strokeWidth={1.5} strokeDasharray="3,3" opacity={0.9} />}
          {peaks && <path d={pathQual} fill="none" stroke={c.gray} strokeWidth={2.5} />}
          {/* inline labels at the right end of the dashed prominence lines */}
          {peaks && (
            <text x={pad.left + pw - 3} y={sy(elevCanon.length) - 4} textAnchor="end" fontSize={9} fill={c.prom} fontFamily="monospace">
              300′ rule
            </text>
          )}
          {peaks && atRound && (
            <text x={pad.left + pw - 3} y={sy(elevAll.length) + 11} textAnchor="end" fontSize={9} fill={c.gray} fontFamily="monospace">
              no rule
            </text>
          )}
          {/* official 14,000′ elevation line (green, dashed reference) */}
          {peaks && (
            <>
              <line x1={sx(CANON_ELEV)} y1={pad.top} x2={sx(CANON_ELEV)} y2={pad.top + ph} stroke={c.elev} strokeWidth={1} strokeDasharray="3,2" opacity={0.8} />
              <text x={sx(CANON_ELEV) - 6} y={pad.top + 10} textAnchor="end" fontSize={9} fill={c.elev} fontFamily="monospace">
                official 14,000′
              </text>
            </>
          )}
          {/* your current elevation cutoff — green solid line + where it meets the curve */}
          {peaks && (
            <>
              <line x1={sx(elevationThreshold)} y1={pad.top} x2={sx(elevationThreshold)} y2={pad.top + ph} stroke={c.elev} strokeWidth={1.5} />
              <circle cx={sx(elevationThreshold)} cy={sy(qualifyingCount)} r={4} fill={c.elev} />
            </>
          )}
          {/* axes */}
          <line x1={pad.left} y1={pad.top + ph} x2={pad.left + pw} y2={pad.top + ph} stroke={c.axis} strokeWidth={1} />
          <text x={pad.left + pw / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={c.text}>
            Elevation (feet)
          </text>
          <text
            x={14}
            y={pad.top + ph / 2}
            textAnchor="middle"
            fontSize={10}
            fill={c.text}
            transform={`rotate(-90 14 ${pad.top + ph / 2})`}
          >
            Number of Peaks
          </text>
          {/* x-axis hover crosshair + tooltip (one row per visible line) */}
          {peaks && hoverE != null && (
            <g pointerEvents="none">
              <line x1={hoverX} y1={pad.top} x2={hoverX} y2={pad.top + ph} stroke={c.axis} strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />
              <circle cx={hoverX} cy={sy(hQual)} r={3} fill={c.gray} stroke={isDark ? '#141418' : '#ffffff'} strokeWidth={1.25} />
              <circle cx={hoverX} cy={sy(hCanon)} r={3} fill={c.prom} stroke={isDark ? '#141418' : '#ffffff'} strokeWidth={1.25} />
              {atRound && (
                <circle cx={hoverX} cy={sy(hAll)} r={3} fill={c.gray} stroke={isDark ? '#141418' : '#ffffff'} strokeWidth={1.25} opacity={0.6} />
              )}
              <g transform={`translate(${hoverLeft ? hoverX + 8 : hoverX - 142}, ${pad.top + 4})`}>
                <rect width={134} height={atRound ? 62 : 49} rx={5} fill={isDark ? '#1f1f23' : '#ffffff'} stroke={c.grid} strokeWidth={1} />
                <text x={8} y={15} fontSize={10} fill={c.text} fontFamily="monospace">{nf.format(Math.round(hoverE / 10) * 10)}′</text>
                <text x={8} y={29} fontSize={10.5} fill={c.gray} fontFamily="monospace">
                  <tspan fontWeight={700}>{nf.format(hQual)}</tspan> your cutoff
                </text>
                <text x={8} y={42} fontSize={10.5} fill={c.prom} fontFamily="monospace">
                  <tspan fontWeight={700}>{nf.format(hCanon)}</tspan> 300′ rule
                </text>
                {atRound && (
                  <text x={8} y={55} fontSize={10.5} fill={c.gray} fontFamily="monospace">
                    <tspan fontWeight={700}>{nf.format(hAll)}</tspan> no rule
                  </text>
                )}
              </g>
            </g>
          )}
        </svg>
        {peaks && atRound && (
          <div className="mt-2 text-[11px] text-gray-500 dark:text-[#8a8a8a]">
            At <span className="font-mono">{nf.format(elevationThreshold)}′</span>:{' '}
            <span className="font-mono">{nf.format(count300)}</span> clear the 300′ rule ·{' '}
            <span className="font-mono">{nf.format(aboveCount)}</span> with no prominence rule (dotted)
          </div>
        )}
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
            <span className="text-gray-500 dark:text-gray-400">
              ({nf.format(cutByProminence)} more clear the height but are cut by the separation rule)
            </span>
          </>
        )}
        .{' '}
        {peaks && (
          <span className="text-gray-500 dark:text-gray-400">
            The official line (14,000′ / 300′) gives {nf.format(canonCount)}.
          </span>
        )}
      </div>

      {/* Sliders — between the chart and the table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6 mb-5">
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">
              Elevation threshold
            </label>
            <span className="font-mono text-base font-semibold text-green-600 dark:text-green-400">
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
            className="peak-slider w-full"
            style={sliderStyle(c.elev, ((elevationThreshold - ELEV_MIN) / (ELEV_MAX - ELEV_MIN)) * 100)}
            aria-label="Elevation threshold in feet"
          />
          <CanonTick pct={((CANON_ELEV - ELEV_MIN) / (ELEV_MAX - ELEV_MIN)) * 100} label="official 14,000′" tone="elev" />
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">
              Prominence cutoff (separation rule)
            </label>
            <span className="font-mono text-base font-semibold text-orange-600 dark:text-orange-400">
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
            className="peak-slider w-full"
            style={sliderStyle(c.prom, (prominenceCutoff / PROM_MAX) * 100)}
            aria-label="Prominence cutoff in feet"
          />
          <CanonTick pct={(CANON_PROM / PROM_MAX) * 100} label="official 300′" tone="prom" />
        </div>
      </div>

      {/* Boundary list */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a] mb-2">
          Qualifying peaks — closest to the line first
        </h3>
        <div className="rounded-lg border border-gray-200 dark:border-[#303031] divide-y divide-gray-100 dark:divide-[#252528] bg-white dark:bg-[#141418]">
          {!peaks && <div className="p-4 text-sm text-gray-400">Loading {nf.format(0)} peaks…</div>}
          {peaks &&
            boundaryPeaks.map((p, i) => (
              <div key={`${p.name}-${p.elevationFt}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="shrink-0 w-1.5 h-6 rounded bg-gray-300 dark:bg-gray-600" />
                <span className="flex-1">
                  {peakUrl(p) ? (
                    <a
                      href={peakUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className={`${p.official ? '' : 'italic'} text-gray-900 dark:text-[#e4e4e4] hover:text-gray-500 dark:hover:text-gray-300 hover:underline`}
                    >
                      {p.name}
                    </a>
                  ) : (
                    <span className={`${p.official ? '' : 'italic'} text-gray-900 dark:text-[#e4e4e4]`}>{p.name}</span>
                  )}
                </span>
                <span className="font-mono text-gray-700 dark:text-[#bbb] tabular-nums">{nf.format(p.elevationFt)}′</span>
                <span className="font-mono tabular-nums w-20 text-right text-gray-400 dark:text-[#6b6b6b]">
                  {nf.format(p.prominenceFt)}′ prom
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
