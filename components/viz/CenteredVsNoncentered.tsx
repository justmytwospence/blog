'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

// --- Math utilities ---

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function normalSample(rng: () => number): number {
  let u1 = rng();
  const u2 = rng();
  while (u1 === 0) u1 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

interface Sample {
  sigma: number;
  theta: number;
  z: number;
}

function generatePosteriorSamples(priorScale: number, nData: number, seed = 42): Sample[] {
  const rng = seededRandom(seed);
  const samples: Sample[] = [];
  const trueSigma = 1.0;

  for (let i = 0; i < 500; i++) {
    const priorWeight = Math.exp(-nData / 10);
    const posteriorMean = priorWeight * priorScale * 0.8 + (1 - priorWeight) * trueSigma;
    const posteriorSd = priorWeight * priorScale * 0.5 + (1 - priorWeight) * 0.1;

    let sigma = Math.abs(posteriorMean + normalSample(rng) * posteriorSd);
    sigma = Math.max(0.05, sigma);
    const theta = normalSample(rng) * sigma;
    const z = theta / sigma;

    samples.push({ sigma, theta, z });
  }
  return samples;
}

function getExpectedPosteriorSigma(priorScale: number, nData: number): number {
  const priorWeight = Math.exp(-nData / 10);
  return priorWeight * priorScale * 0.8 + (1 - priorWeight) * 1.0;
}

// --- SVG sub-components ---

interface DistributionProps {
  type: 'standard-normal' | 'scaled-normal' | 'halfnormal' | 'wide-normal' | 'deterministic';
  scale?: number;
  width?: number;
  height?: number;
  color: string;
}

function DynamicDistribution({ type, scale = 1, width = 80, height = 40, color }: DistributionProps) {
  const padding = 4;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const fixedRange = 4;
  const n = 60;

  if (type === 'deterministic') {
    return (
      <svg width={width} height={height} className="block">
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontStyle="italic"
          className="font-mono"
        >
          {'μ + σ·z'}
        </text>
      </svg>
    );
  }

  const points: { x: number; y: number }[] = [];
  const effectiveScale = Math.max(0.15, scale);

  for (let i = 0; i <= n; i++) {
    let x: number, y: number;
    if (type === 'halfnormal') {
      x = (fixedRange * i) / n;
      y = Math.exp(-0.5 * Math.pow(x / effectiveScale, 2)) / effectiveScale;
    } else if (type === 'scaled-normal') {
      x = -fixedRange + (2 * fixedRange * i) / n;
      y = Math.exp(-0.5 * Math.pow(x / effectiveScale, 2)) / effectiveScale;
    } else if (type === 'wide-normal') {
      x = -fixedRange + (2 * fixedRange * i) / n;
      y = Math.exp(-0.5 * Math.pow(x / 2, 2));
    } else {
      // standard-normal
      x = -fixedRange + (2 * fixedRange * i) / n;
      y = Math.exp(-0.5 * x * x);
    }
    points.push({ x, y });
  }

  const maxY = Math.max(...points.map(p => p.y));
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const sx = (v: number) => padding + ((v - minX) / (maxX - minX)) * plotWidth;
  const sy = (v: number) => padding + plotHeight - (v / maxY) * plotHeight;

  const areaPath = [
    `M ${sx(points[0].x)} ${sy(0)}`,
    ...points.map(p => `L ${sx(p.x)} ${sy(p.y)}`),
    `L ${sx(points[points.length - 1].x)} ${sy(0)} Z`,
  ].join(' ');

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(' ');

  const centerX = type === 'halfnormal' ? padding : width / 2;

  return (
    <svg width={width} height={height} className="block">
      <line x1={padding} y1={padding + plotHeight} x2={padding + plotWidth} y2={padding + plotHeight} stroke="currentColor" strokeWidth="1" className="text-gray-400 dark:text-gray-600" />
      <line x1={centerX} y1={padding} x2={centerX} y2={padding + plotHeight} stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" className="text-gray-400 dark:text-gray-600" />
      <path d={areaPath} fill={color} opacity="0.15" className="transition-all duration-300" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" className="transition-all duration-300" />
    </svg>
  );
}

interface DAGNodeProps {
  x: number;
  y: number;
  label: string;
  sublabel: string;
  distribution: DistributionProps['type'];
  scale?: number;
  isStochastic?: boolean;
  highlight?: boolean;
  color: string;
  width?: number;
  height?: number;
  isDark: boolean;
}

function DAGNode({ x, y, label, sublabel, distribution, scale = 1, isStochastic = true, highlight = false, color, width = 120, height = 85, isDark }: DAGNodeProps) {
  const bgColor = highlight
    ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
    : (isDark ? 'rgba(20,20,35,0.9)' : 'rgba(255,255,255,0.95)');
  const borderColor = highlight ? (isDark ? '#ef4444' : '#dc2626') : color;
  const rx = isStochastic ? height / 2 : 8;

  return (
    <g transform={`translate(${x - width / 2}, ${y - height / 2})`}>
      {highlight && (
        <rect x={-4} y={-4} width={width + 8} height={height + 8} rx={rx + 4} fill="none" stroke={borderColor} strokeWidth="1" opacity="0.3" />
      )}
      <rect x={0} y={0} width={width} height={height} rx={rx} fill={bgColor} stroke={borderColor} strokeWidth={highlight ? 2 : 1.5} strokeDasharray={isStochastic ? 'none' : '6,4'} />
      <text x={width / 2} y={18} textAnchor="middle" fill={isDark ? '#e8e8e8' : '#1f2937'} fontSize="16" fontWeight="600" fontFamily="Georgia, serif" fontStyle="italic">
        {label}
      </text>
      <g transform={`translate(${(width - 80) / 2}, 24)`}>
        <DynamicDistribution type={distribution} scale={scale} color={borderColor} />
      </g>
      <text x={width / 2} y={height - 8} textAnchor="middle" fill={highlight ? (isDark ? '#fca5a5' : '#dc2626') : (isDark ? '#888' : '#6b7280')} fontSize="10" className="font-mono">
        {sublabel}
      </text>
    </g>
  );
}

function DAGArrow({ from, to, color, offset = 0 }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; offset?: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const startX = from.x + (dx / len) * 50;
  const startY = from.y + (dy / len) * 50;
  const endX = to.x - (dx / len) * 50;
  const endY = to.y - (dy / len) * 50;
  const perpX = -(dy / len) * offset;
  const perpY = (dx / len) * offset;
  const midX = (startX + endX) / 2 + perpX;
  const midY = (startY + endY) / 2 + perpY;
  const pathD = offset !== 0
    ? `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
    : `M ${startX} ${startY} L ${endX} ${endY}`;
  const markerId = `arr-${Math.round(from.x)}-${Math.round(to.x)}-${offset}`;

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L8,4 z" fill={color} />
        </marker>
      </defs>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" markerEnd={`url(#${markerId})`} opacity="0.8" />
    </g>
  );
}

// --- DAG Panel ---

function ParameterizationDAG({ priorScale, nData, type, isDark }: { priorScale: number; nData: number; type: 'centered' | 'non-centered'; isDark: boolean }) {
  const isCentered = type === 'centered';
  const svgHeight = isCentered ? 380 : 480;
  const accentColor = isCentered
    ? (isDark ? '#ef4444' : '#dc2626')
    : (isDark ? '#2dd4bf' : '#0d9488');
  const mutedColor = isDark ? '#555' : '#9ca3af';
  const sigmaColor = isDark ? '#888' : '#6b7280';

  const muPos = { x: 120, y: 60 };
  const sigmaPos = { x: 260, y: 60 };
  const zPos = { x: 260, y: 180 };
  const thetaPos = { x: 180, y: isCentered ? 180 : 290 };
  const yPos = { x: 180, y: isCentered ? 300 : 410 };

  const expectedSigma = getExpectedPosteriorSigma(priorScale, nData);
  const showFunnelWarning = isCentered && expectedSigma < 0.5;
  const warningColor = isDark ? '#ef4444' : '#dc2626';
  const stableColor = isDark ? '#2dd4bf' : '#0d9488';

  return (
    <div className={`rounded-xl p-4 border ${
      isCentered
        ? 'border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10'
        : 'border-teal-200 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/10'
    }`}>
      <div className={`text-center text-sm font-bold mb-2 font-mono flex items-center justify-center gap-2 ${
        isCentered ? 'text-red-600 dark:text-red-400' : 'text-teal-600 dark:text-teal-400'
      }`}>
        <span className="text-lg">{isCentered ? '\u2717' : '\u2713'}</span>
        {isCentered ? 'CENTERED' : 'NON-CENTERED'}
      </div>

      <svg width={360} height={svgHeight} className="block mx-auto max-w-full">
        {isCentered ? (
          <>
            <DAGArrow from={muPos} to={thetaPos} color={mutedColor} offset={-25} />
            <DAGArrow from={sigmaPos} to={thetaPos} color={showFunnelWarning ? warningColor : sigmaColor} offset={25} />
            <DAGArrow from={thetaPos} to={yPos} color={mutedColor} />
            <DAGNode x={muPos.x} y={muPos.y} label={'\u03bc'} sublabel="~ N(0, 10)" distribution="wide-normal" color={mutedColor} isDark={isDark} />
            <DAGNode x={sigmaPos.x} y={sigmaPos.y} label={'\u03c3'} sublabel={`~ HalfN(0, ${priorScale.toFixed(1)})`} distribution="halfnormal" scale={priorScale} color={sigmaColor} isDark={isDark} />
            <DAGNode x={thetaPos.x} y={thetaPos.y} label={'\u03b8'} sublabel={`~ N(\u03bc, \u03c3)`} distribution="scaled-normal" scale={expectedSigma} color={accentColor} highlight={showFunnelWarning} width={130} height={90} isDark={isDark} />
            <DAGNode x={yPos.x} y={yPos.y} label="y" sublabel="observed" distribution="standard-normal" color={mutedColor} isDark={isDark} />
            {showFunnelWarning && (
              <g transform="translate(20, 165)">
                <rect x={0} y={0} width={95} height={50} rx={6} fill={isDark ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.08)'} stroke={warningColor} strokeWidth="1" />
                <text x={47} y={20} textAnchor="middle" fill={warningColor} fontSize="10" fontWeight="600" className="font-mono">FUNNEL</text>
                <text x={47} y={34} textAnchor="middle" fill={isDark ? '#fca5a5' : '#b91c1c'} fontSize="8" className="font-mono">small {'\u03c3'} squeezes</text>
                <text x={47} y={46} textAnchor="middle" fill={isDark ? '#fca5a5' : '#b91c1c'} fontSize="8" className="font-mono">{'\u03b8'} distribution</text>
              </g>
            )}
          </>
        ) : (
          <>
            <DAGArrow from={muPos} to={thetaPos} color={mutedColor} offset={-30} />
            <DAGArrow from={sigmaPos} to={thetaPos} color={mutedColor} offset={30} />
            <DAGArrow from={zPos} to={thetaPos} color={stableColor} />
            <DAGArrow from={thetaPos} to={yPos} color={mutedColor} />
            <DAGNode x={muPos.x} y={muPos.y} label={'\u03bc'} sublabel="~ N(0, 10)" distribution="wide-normal" color={mutedColor} isDark={isDark} />
            <DAGNode x={sigmaPos.x} y={sigmaPos.y} label={'\u03c3'} sublabel={`~ HalfN(0, ${priorScale.toFixed(1)})`} distribution="halfnormal" scale={priorScale} color={sigmaColor} isDark={isDark} />
            <DAGNode x={zPos.x} y={zPos.y} label="z" sublabel="~ N(0, 1)" distribution="standard-normal" color={stableColor} isDark={isDark} />
            <DAGNode x={thetaPos.x} y={thetaPos.y} label={'\u03b8'} sublabel={`= \u03bc + \u03c3\u00b7z`} distribution="deterministic" scale={expectedSigma} isStochastic={false} color={stableColor} width={130} height={90} isDark={isDark} />
            <DAGNode x={yPos.x} y={yPos.y} label="y" sublabel="observed" distribution="standard-normal" color={mutedColor} isDark={isDark} />
            <g transform="translate(20, 165)">
              <rect x={0} y={0} width={95} height={50} rx={6} fill={isDark ? 'rgba(45,212,191,0.1)' : 'rgba(13,148,136,0.06)'} stroke={stableColor} strokeWidth="1" />
              <text x={47} y={20} textAnchor="middle" fill={stableColor} fontSize="10" fontWeight="600" className="font-mono">STABLE</text>
              <text x={47} y={34} textAnchor="middle" fill={isDark ? '#5eead4' : '#0f766e'} fontSize="8" className="font-mono">z always N(0,1)</text>
              <text x={47} y={46} textAnchor="middle" fill={isDark ? '#5eead4' : '#0f766e'} fontSize="8" className="font-mono">regardless of {'\u03c3'}</text>
            </g>
          </>
        )}
      </svg>

      <div className="flex justify-center gap-6 mt-1 text-[10px] text-gray-500 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-[1.5px] border-gray-400 dark:border-gray-600 bg-white dark:bg-[#141423]" />
          <span>stochastic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-[1.5px] border-dashed border-gray-400 dark:border-gray-600 bg-white dark:bg-[#141423]" />
          <span>deterministic</span>
        </div>
      </div>
    </div>
  );
}

// --- Scatter Plot ---

function FunnelPlot({ samples, xKey, yKey, xLabel, yLabel, title, colorByDifficulty, isDark }: {
  samples: Sample[];
  xKey: keyof Sample;
  yKey: keyof Sample;
  xLabel: string;
  yLabel: string;
  title: string;
  colorByDifficulty: boolean;
  isDark: boolean;
}) {
  const width = 320;
  const height = 280;
  const pad = { top: 36, right: 20, bottom: 45, left: 50 };
  const pw = width - pad.left - pad.right;
  const ph = height - pad.top - pad.bottom;

  const xValues = samples.map(d => d[xKey]);
  const yValues = samples.map(d => d[yKey]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues);
  const xPad = (xMax - xMin) * 0.1 || 1;
  const yPadding = (yMax - yMin) * 0.1 || 0.5;
  const xDomain: [number, number] = [xMin - xPad, xMax + xPad];
  const yDomain: [number, number] = [yMin, yMax + yPadding];
  const sx = (v: number) => pad.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * pw;
  const sy = (v: number) => pad.top + ph - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ph;

  const getColor = (d: Sample) => {
    if (!colorByDifficulty) return isDark ? '#2dd4bf' : '#0d9488';
    const difficulty = Math.max(0, 1 - d.sigma / 1.2);
    if (isDark) {
      const r = Math.round(45 + (239 - 45) * difficulty);
      const g = Math.round(212 - (212 - 68) * difficulty);
      const b = Math.round(191 - (191 - 68) * difficulty);
      return `rgb(${r},${g},${b})`;
    }
    const r = Math.round(13 + (220 - 13) * difficulty);
    const g = Math.round(148 - (148 - 38) * difficulty);
    const b = Math.round(136 - (136 - 38) * difficulty);
    return `rgb(${r},${g},${b})`;
  };

  const bgFill = isDark ? '#0a0a12' : '#f8fafc';
  const gridStroke = isDark ? '#1a1a2e' : '#e2e8f0';
  const textColor = isDark ? '#888' : '#6b7280';
  const titleColor = isDark ? '#ccc' : '#374151';
  const zeroStroke = isDark ? '#333' : '#cbd5e1';

  return (
    <svg width={width} height={height} className="block max-w-full" viewBox={`0 0 ${width} ${height}`}>
      <rect x={pad.left} y={pad.top} width={pw} height={ph} fill={bgFill} stroke={gridStroke} strokeWidth="1" />
      {[0.25, 0.5, 0.75].map((t, i) => (
        <line key={i} x1={pad.left} y1={pad.top + t * ph} x2={pad.left + pw} y2={pad.top + t * ph} stroke={gridStroke} opacity="0.5" />
      ))}
      {xDomain[0] < 0 && xDomain[1] > 0 && (
        <line x1={sx(0)} y1={pad.top} x2={sx(0)} y2={pad.top + ph} stroke={zeroStroke} strokeDasharray="4,4" />
      )}
      {samples.map((d, i) => (
        <circle key={i} cx={sx(d[xKey])} cy={sy(d[yKey])} r={2.5} fill={getColor(d)} opacity={0.6} />
      ))}
      <text x={width / 2} y={18} textAnchor="middle" fill={titleColor} fontSize="12" fontWeight="600" className="font-mono">{title}</text>
      <text x={width / 2} y={height - 8} textAnchor="middle" fill={textColor} fontSize="11" className="font-mono">{xLabel}</text>
      <text x={14} y={height / 2} textAnchor="middle" fill={textColor} fontSize="11" className="font-mono" transform={`rotate(-90, 14, ${height / 2})`}>{yLabel}</text>
    </svg>
  );
}

// --- HMC Sampler with Divergence Detection ---

function randomNormal(): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeCenteredLogDensity(priorScale: number) {
  return (theta: number, logSigma: number): number => {
    const sigma = Math.exp(logSigma);
    // HalfNormal(0, priorScale) prior on sigma, on log scale
    const logPriorSigma = Math.log(2) - 0.5 * (sigma / priorScale) ** 2 - Math.log(priorScale) + logSigma;
    // theta ~ N(0, sigma^2)
    const logLikelihood = -0.5 * Math.log(2 * Math.PI) - logSigma - 0.5 * (theta / sigma) ** 2;
    return logPriorSigma + logLikelihood;
  };
}

function makeNoncenteredLogDensity(priorScale: number) {
  return (z: number, logSigma: number): number => {
    const sigma = Math.exp(logSigma);
    const logPriorSigma = Math.log(2) - 0.5 * (sigma / priorScale) ** 2 - Math.log(priorScale) + logSigma;
    const logPriorZ = -0.5 * Math.log(2 * Math.PI) - 0.5 * z * z;
    return logPriorSigma + logPriorZ;
  };
}

const DIVERGENCE_THRESHOLD = 8;

interface HmcSample {
  x: number;
  y: number;
  divergent: boolean;
}

function hmcStep(
  current: { x: number; y: number },
  logDensity: (x: number, y: number) => number,
  stepSize: number,
  nLeapfrog: number,
): HmcSample {
  const eps = 1e-4;
  const grad = (x: number, y: number): [number, number] => {
    const f0 = logDensity(x, y);
    return [(logDensity(x + eps, y) - f0) / eps, (logDensity(x, y + eps) - f0) / eps];
  };

  let px = randomNormal();
  let py = randomNormal();
  let x = current.x;
  let y = current.y;
  const initH = -logDensity(x, y) + 0.5 * (px * px + py * py);

  let [gx, gy] = grad(x, y);
  px += 0.5 * stepSize * gx;
  py += 0.5 * stepSize * gy;

  for (let i = 0; i < nLeapfrog; i++) {
    x += stepSize * px;
    y += stepSize * py;
    [gx, gy] = grad(x, y);
    if (i < nLeapfrog - 1) {
      px += stepSize * gx;
      py += stepSize * gy;
    }
  }
  px += 0.5 * stepSize * gx;
  py += 0.5 * stepSize * gy;

  const finalH = -logDensity(x, y) + 0.5 * (px * px + py * py);
  const energyError = Math.abs(finalH - initH);
  const divergent = energyError > DIVERGENCE_THRESHOLD || !isFinite(finalH);

  if (divergent) {
    // Reject but mark as divergent at the *proposal* location
    return { x, y, divergent: true };
  }

  const acceptProb = Math.min(1, Math.exp(initH - finalH));
  if (Math.random() < acceptProb) {
    return { x, y, divergent: false };
  }
  return { x: current.x, y: current.y, divergent: false };
}

// Canvas-based sampler panel
function SamplerPanel({ title, logDensity, xRange, yRange, xLabel, yLabel, stepSize, isDark, isRunning, speed }: {
  title: string;
  logDensity: (x: number, y: number) => number;
  xRange: [number, number];
  yRange: [number, number];
  xLabel: string;
  yLabel: string;
  stepSize: number;
  isDark: boolean;
  isRunning: boolean;
  speed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<HmcSample[]>([{ x: 0, y: -0.5, divergent: false }]);
  const statsRef = useRef({ total: 0, divergences: 0, accepted: 0 });
  const animRef = useRef<number>(0);
  const lastStepRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Draw heatmap
    const res = 3;
    const cols = Math.ceil(w / res);
    const rows = Math.ceil(h / res);
    const vals: number[] = new Array(cols * rows);
    let maxVal = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = xRange[0] + (c / cols) * (xRange[1] - xRange[0]);
        const y = yRange[1] - (r / rows) * (yRange[1] - yRange[0]);
        const v = logDensity(x, y);
        vals[r * cols + c] = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const img = ctx.createImageData(w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const density = Math.exp(vals[r * cols + c] - maxVal);
        const t = Math.pow(density, 0.4);
        const red = isDark ? Math.floor(t * 140 + (1 - t) * 12) : Math.floor(t * 180 + (1 - t) * 248);
        const green = isDark ? Math.floor(t * 60 + (1 - t) * 12) : Math.floor(t * 90 + (1 - t) * 248);
        const blue = isDark ? Math.floor(t * 200 + (1 - t) * 20) : Math.floor(t * 220 + (1 - t) * 248);
        for (let dr = 0; dr < res; dr++) {
          for (let dc = 0; dc < res; dc++) {
            const px = c * res + dc;
            const py = r * res + dr;
            if (px < w && py < h) {
              const idx = (py * w + px) * 4;
              img.data[idx] = red;
              img.data[idx + 1] = green;
              img.data[idx + 2] = blue;
              img.data[idx + 3] = 255;
            }
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // Map to canvas coords
    const toC = (x: number, y: number): [number, number] => [
      ((x - xRange[0]) / (xRange[1] - xRange[0])) * w,
      ((yRange[1] - y) / (yRange[1] - yRange[0])) * h,
    ];

    const samps = samplesRef.current;

    // Draw trace
    if (samps.length > 1) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const [sx, sy] = toC(samps[0].x, samps[0].y);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < samps.length; i++) {
        const [px, py] = toC(samps[i].x, samps[i].y);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw points
    for (let i = 0; i < samps.length; i++) {
      const s = samps[i];
      const [px, py] = toC(s.x, s.y);
      const isLast = i === samps.length - 1;

      if (s.divergent) {
        // Divergent: red with glow
        ctx.fillStyle = isDark ? '#ff4444' : '#dc2626';
        ctx.beginPath();
        ctx.arc(px, py, isLast ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fill();
        // X mark
        ctx.strokeStyle = isDark ? '#ff8888' : '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 4, py - 4);
        ctx.lineTo(px + 4, py + 4);
        ctx.moveTo(px + 4, py - 4);
        ctx.lineTo(px - 4, py + 4);
        ctx.stroke();
      } else {
        const alpha = 0.2 + 0.6 * (i / samps.length);
        if (isLast) {
          ctx.fillStyle = isDark ? '#ffdd33' : '#2563eb';
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillStyle = isDark ? `rgba(255,255,255,${alpha * 0.5})` : `rgba(30,30,30,${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    // Axis labels
    const textColor = isDark ? '#777' : '#888';
    ctx.fillStyle = textColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, w / 2, h - 6);
    ctx.save();
    ctx.translate(14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [logDensity, xRange, yRange, xLabel, yLabel, isDark]);

  // Reset when density changes
  useEffect(() => {
    samplesRef.current = [{ x: 0, y: -0.5, divergent: false }];
    statsRef.current = { total: 0, divergences: 0, accepted: 0 };
    draw();
  }, [logDensity, draw]);

  // Animation loop
  useEffect(() => {
    if (!isRunning) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const interval = Math.max(15, 150 - speed * 14);
    const step = (ts: number) => {
      if (ts - lastStepRef.current >= interval) {
        const cur = samplesRef.current[samplesRef.current.length - 1];
        const result = hmcStep({ x: cur.x, y: cur.y }, logDensity, stepSize, 15);

        if (result.divergent) {
          // Record the divergent proposal but stay at current position
          samplesRef.current.push({ x: result.x, y: result.y, divergent: true });
          statsRef.current.divergences++;
        } else {
          samplesRef.current.push(result);
          if (result.x !== cur.x || result.y !== cur.y) statsRef.current.accepted++;
        }
        statsRef.current.total++;

        if (samplesRef.current.length > 400) {
          samplesRef.current = samplesRef.current.slice(-400);
        }
        draw();
        lastStepRef.current = ts;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isRunning, speed, logDensity, stepSize, draw]);

  const stats = statsRef.current;
  const divRate = stats.total > 0 ? ((stats.divergences / stats.total) * 100).toFixed(1) : '0.0';
  const hasDivergences = stats.divergences > 0;

  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-semibold mb-1 text-gray-800 dark:text-gray-200 font-mono">{title}</h4>
      <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#303031]">
        <canvas ref={canvasRef} width={380} height={380} className="w-full" style={{ aspectRatio: '1 / 1' }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-mono">
        <span className="text-gray-500 dark:text-gray-500">n={stats.total}</span>
        <span className={hasDivergences ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-500'}>
          {stats.divergences} divergence{stats.divergences !== 1 ? 's' : ''} ({divRate}%)
        </span>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function CenteredVsNoncentered() {
  const [priorScale, setPriorScale] = useState(0.5);
  const [nData, setNData] = useState(3);
  const [isDark, setIsDark] = useState(false);
  const [samplerRunning, setSamplerRunning] = useState(false);
  const [samplerSpeed, setSamplerSpeed] = useState(5);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const samples = useMemo(() => generatePosteriorSamples(priorScale, nData, 42), [priorScale, nData]);
  const centeredLogDensity = useMemo(() => makeCenteredLogDensity(priorScale), [priorScale]);
  const noncenteredLogDensity = useMemo(() => makeNoncenteredLogDensity(priorScale), [priorScale]);
  const expectedSigma = getExpectedPosteriorSigma(priorScale, nData);

  // Stop sampler when prior scale changes (densities change)
  useEffect(() => { setSamplerRunning(false); }, [priorScale]);
  const difficultyPct = Math.min(100, Math.max(0, (1 - expectedSigma / 1.5) * 100));
  const difficultyLabel = difficultyPct > 60 ? 'HARD' : difficultyPct > 35 ? 'MODERATE' : 'EASY';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl p-5 border border-gray-200 dark:border-[#303031] bg-gray-50 dark:bg-[#1e1e1e]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Prior scale */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[10px] font-semibold tracking-wide text-gray-500 dark:text-gray-500 uppercase">Prior Scale on {'\u03c3'}</label>
              <span className="text-lg font-light text-teal-600 dark:text-teal-400 font-mono">
                HalfN(0, <strong>{priorScale.toFixed(2)}</strong>)
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={priorScale}
              onChange={(e) => setPriorScale(parseFloat(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-600 mt-1">
              <span>tight prior ({'\u03c3'} likely small)</span>
              <span>diffuse prior</span>
            </div>
          </div>

          {/* Data per group */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[10px] font-semibold tracking-wide text-gray-500 dark:text-gray-500 uppercase">Data Per Group</label>
              <span className="text-lg font-semibold text-amber-500 dark:text-amber-400 font-mono">n = {nData}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={nData}
              onChange={(e) => setNData(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-600 mt-1">
              <span>sparse (prior dominates)</span>
              <span>rich (data dominates)</span>
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div className="rounded-lg p-3 bg-white dark:bg-[#141418] border border-gray-100 dark:border-[#252530]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-500 uppercase">Expected Posterior {'\u03c3'}</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-mono">{'\u2248'} {expectedSigma.toFixed(2)}</span>
            </div>
            <p className="text-[9px] text-gray-400 dark:text-gray-600">
              {nData < 10 ? 'Prior-dominated: \u03c3 posterior \u2248 prior' : nData < 30 ? 'Mixed: data pulling toward true \u03c3' : 'Data-dominated: \u03c3 posterior concentrated'}
            </p>
          </div>

          <div className="rounded-lg p-3 bg-white dark:bg-[#141418] border border-gray-100 dark:border-[#252530]">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-500 uppercase">Centered Difficulty</span>
              <span className={`text-xs font-semibold font-mono ${
                difficultyPct > 60 ? 'text-red-500' : difficultyPct > 35 ? 'text-amber-500' : 'text-teal-500'
              }`}>
                {difficultyLabel}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  difficultyPct > 60 ? 'bg-red-500' : difficultyPct > 35 ? 'bg-amber-500' : 'bg-teal-500'
                }`}
                style={{ width: `${difficultyPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DAG diagrams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParameterizationDAG priorScale={priorScale} nData={nData} type="centered" isDark={isDark} />
        <ParameterizationDAG priorScale={priorScale} nData={nData} type="non-centered" isDark={isDark} />
      </div>

      {/* Scatter plots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-3 border border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/5 flex justify-center">
          <FunnelPlot
            samples={samples}
            xKey="theta"
            yKey="sigma"
            xLabel={'\u03b8'}
            yLabel={'\u03c3'}
            title={'Joint Posterior: (\u03c3, \u03b8)'}
            colorByDifficulty={true}
            isDark={isDark}
          />
        </div>
        <div className="rounded-xl p-3 border border-teal-200 dark:border-teal-900/30 bg-teal-50/30 dark:bg-teal-950/5 flex justify-center">
          <FunnelPlot
            samples={samples}
            xKey="z"
            yKey="sigma"
            xLabel="z"
            yLabel={'\u03c3'}
            title={'Joint Posterior: (\u03c3, z)'}
            colorByDifficulty={false}
            isDark={isDark}
          />
        </div>
      </div>

      {/* HMC Sampling Simulation */}
      <div className="rounded-xl p-5 border border-gray-200 dark:border-[#303031] bg-gray-50 dark:bg-[#1e1e1e]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">HMC Sampling Simulation</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500">Watch MCMC explore both geometries. <span className="text-red-500">Red {'\u2717'} marks = divergent transitions.</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-semibold">Speed</label>
              <input
                type="range"
                min={1}
                max={10}
                value={samplerSpeed}
                onChange={(e) => setSamplerSpeed(Number(e.target.value))}
                className="w-20 accent-blue-500"
              />
            </div>
            <button
              onClick={() => setSamplerRunning(!samplerRunning)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                samplerRunning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {samplerRunning ? 'Pause' : 'Run'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SamplerPanel
            title={`Centered (\u03b8, log \u03c3)`}
            logDensity={centeredLogDensity}
            xRange={[-5, 5]}
            yRange={[-4, 2]}
            xLabel={'\u03b8'}
            yLabel={'log \u03c3'}
            stepSize={0.05}
            isDark={isDark}
            isRunning={samplerRunning}
            speed={samplerSpeed}
          />
          <SamplerPanel
            title={`Non-Centered (z, log \u03c3)`}
            logDensity={noncenteredLogDensity}
            xRange={[-4, 4]}
            yRange={[-4, 2]}
            xLabel="z"
            yLabel={'log \u03c3'}
            stepSize={0.15}
            isDark={isDark}
            isRunning={samplerRunning}
            speed={samplerSpeed}
          />
        </div>

        <div className="mt-3 flex justify-center gap-6 text-[10px] text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-yellow-400" />
            <span>current position</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-400" />
            <span>accepted sample</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>divergence</span>
          </div>
        </div>
      </div>

      {/* Key insight */}
      <div className="rounded-xl p-5 border border-gray-200 dark:border-[#252530] bg-white dark:bg-[#141418]">
        <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 space-y-3">
          <p>
            <strong className="text-teal-600 dark:text-teal-400">What you&apos;re controlling:</strong> The <em>prior</em> on {'\u03c3'} (how tight/diffuse) and the <em>amount of data</em> (which determines how much the likelihood overwhelms the prior).
          </p>
          <p>
            <strong className="text-red-600 dark:text-red-400">When funnels form:</strong> When the posterior on {'\u03c3'} concentrates at small values {'\u2014'} either because the prior favors small {'\u03c3'} (tight prior + little data) or because the true data-generating {'\u03c3'} is small (lots of data from low-variance groups).
          </p>
          <p>
            <strong className="text-teal-600 dark:text-teal-400">The fix:</strong> Non-centered parameterization samples z ~ N(0,1) which is <em>always</em> the same shape, regardless of what {'\u03c3'} values the posterior favors. The funnel geometry vanishes. In practice, you&apos;ll see this as fewer divergent transitions and higher effective sample sizes in tools like PyMC and Stan.
          </p>
        </div>
      </div>
    </div>
  );
}
