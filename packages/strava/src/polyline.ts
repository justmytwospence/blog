/**
 * Pure geometry helpers: Google encoded-polyline decoding and track downsampling
 * (Ramer–Douglas–Peucker + a hard point cap). No I/O — fully unit-testable.
 */

/** One trackpoint carrying every channel so downsampling keeps them index-aligned. */
export interface TrackPoint {
  lat: number;
  lng: number;
  alt: number;
  dist: number;
  grade: number;
  vel: number;
  hr: number;
}

/** Decode a Google-encoded polyline string into [lat, lng] pairs. */
export function decodePolyline(str: string, precision = 5): Array<[number, number]> {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<[number, number]> = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

/** Perpendicular distance (meters) from point p to segment a→b via local equirectangular projection. */
function perpDistanceMeters(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const cosLat = Math.cos(a.lat * rad);
  const px = (p.lng - a.lng) * rad * R * cosLat;
  const py = (p.lat - a.lat) * rad * R;
  const bx = (b.lng - a.lng) * rad * R * cosLat;
  const by = (b.lat - a.lat) * rad * R;
  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.hypot(px, py);
  let t = (px * bx + py * by) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = t * bx;
  const cy = t * by;
  return Math.hypot(px - cx, py - cy);
}

/** Ramer–Douglas–Peucker simplification (iterative). Returns the kept points in order. */
function rdp(points: TrackPoint[], epsilonMeters: number): TrackPoint[] {
  const n = points.length;
  if (n <= 2) return points.slice();
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    let maxDist = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistanceMeters(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > epsilonMeters && idx !== -1) {
      keep[idx] = true;
      stack.push([start, idx]);
      stack.push([idx, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Uniformly decimate to at most maxPoints, always keeping first and last. */
function decimate(points: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const out: TrackPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

/**
 * Downsample a track: RDP (default ε = 8 m) then a hard cap (default 1500 points).
 * No-op for tracks already under two points.
 */
export function downsampleTrack(
  points: TrackPoint[],
  opts?: { epsilonMeters?: number; maxPoints?: number },
): TrackPoint[] {
  const epsilon = opts?.epsilonMeters ?? 8;
  const maxPoints = opts?.maxPoints ?? 1500;
  if (points.length <= 2) return points.slice();
  const simplified = rdp(points, epsilon);
  return simplified.length > maxPoints ? decimate(simplified, maxPoints) : simplified;
}
