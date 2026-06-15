import { decodePolyline } from '@blog/strava';

/**
 * A tiny inline SVG of a route's shape from its encoded summary polyline (north up).
 * Server-renderable (decodePolyline is isomorphic), so it works on cards without client JS.
 */
export function RouteThumb({
  polyline,
  className,
  stroke = '#2563eb',
}: {
  polyline: string;
  className?: string;
  stroke?: string;
}) {
  const pts = decodePolyline(polyline); // [lat, lng][]
  if (!pts || pts.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lat, lng] of pts) {
    if (lng < minX) minX = lng;
    if (lng > maxX) maxX = lng;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }

  const W = 200;
  const H = 120;
  const pad = 12;
  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;
  const scale = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const ox = (W - sx * scale) / 2;
  const oy = (H - sy * scale) / 2;
  const points = pts
    .map(([lat, lng]) => `${(ox + (lng - minX) * scale).toFixed(1)},${(oy + (maxY - lat) * scale).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
