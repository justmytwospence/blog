interface SparklineProps {
  /** Daily or weekly commit totals, oldest first. */
  points: number[];
  label: string;
  period: 'month' | 'year';
}

const HEIGHT = 48;

/**
 * A histogram of daily or weekly activity, scaled to its own busiest bin: it shows the
 * shape of one project's activity, so magnitude is left to the caption beside it.
 */
export function Sparkline({ points, label, period }: SparklineProps) {
  const max = Math.max(0, ...points);
  if (points.length < 2 || max <= 0) return null;

  return (
    <div>
    <div className="relative border-b border-gray-300 dark:border-gray-600">
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
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-0.5">
      {points.map((n, i) => (
        <span key={i} className="flex flex-1 justify-center">
          {n <= 0 && <span className="h-0.5 w-px bg-gray-300 dark:bg-gray-600" />}
        </span>
      ))}
    </div>
    </div>
    <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
      <span>{period === 'month' ? '30 days ago' : '1 year ago'}</span>
      <span>Today</span>
    </div>
    </div>
  );
}
