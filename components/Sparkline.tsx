interface SparklineProps {
  /** Weekly commit totals, oldest first. */
  points: number[];
  label: string;
}

const HEIGHT = 32;

/**
 * A filled line of weekly activity, scaled to its own busiest week: it shows the shape of one
 * project's activity, so magnitude is left to the caption beside it.
 */
export function Sparkline({ points, label }: SparklineProps) {
  const max = Math.max(0, ...points);
  if (points.length < 2 || max <= 0) return null;
  const width = points.length - 1;
  // Keep a pixel of headroom at both edges so the stroke is never clipped.
  const y = (n: number) => HEIGHT - 1 - (n / max) * (HEIGHT - 2);
  const line = points.map((n, i) => `${i},${y(n).toFixed(2)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="block h-8 w-full text-[#30a14e] dark:text-[#26a641]"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <polygon points={`0,${HEIGHT} ${line} ${width},${HEIGHT}`} fill="currentColor" fillOpacity={0.15} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
