interface SparklineProps {
  /** Weekly commit totals, oldest first. */
  points: number[];
  /** Shared ceiling so every card's sparkline is drawn on the same scale. */
  max: number;
  label: string;
}

const HEIGHT = 32;

/**
 * A filled line of weekly activity. Heights use a log scale against the shared max, so cards stay
 * comparable but one very busy project doesn't flatten every other card to a baseline.
 */
export function Sparkline({ points, max, label }: SparklineProps) {
  if (points.length < 2 || max <= 0) return null;
  const width = points.length - 1;
  // Keep a pixel of headroom at both edges so the stroke is never clipped.
  const y = (n: number) => HEIGHT - 1 - (Math.log1p(n) / Math.log1p(max)) * (HEIGHT - 2);
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
