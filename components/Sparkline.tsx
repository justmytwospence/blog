interface SparklineProps {
  /** Daily or weekly commit totals, oldest first. */
  points: number[];
  label: string;
}

const HEIGHT = 48;

/**
 * A histogram of daily or weekly activity, scaled to its own busiest bin: it shows the
 * shape of one project's activity, so magnitude is left to the caption beside it.
 */
export function Sparkline({ points, label }: SparklineProps) {
  const max = Math.max(0, ...points);
  if (points.length < 2 || max <= 0) return null;

  return (
    <svg
      viewBox={`0 0 ${points.length} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="block h-12 w-full text-[#30a14e] dark:text-[#26a641]"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      {points.map((n, i) => {
        if (n <= 0) return null;
        // Nonzero bins always get at least 2 units so a single commit stays visible.
        const h = Math.max(2, (n / max) * HEIGHT);
        return <rect key={i} x={i} y={HEIGHT - h} width={0.8} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}
