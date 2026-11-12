/**
 * Pure geometry helpers for authored objective routes: stitching OSM ways, densifying and thinning
 * lines, distance/gain stats and building an AdventureTrack. No network, no fs. Used by
 * scripts/objectives-build.ts. Points are [lat, lng] unless stated.
 */
import { downsampleTrack, encodePolyline } from '@blog/strava';
import type { TrackPoint } from '@blog/strava';
import type { AdventureTrack } from '@blog/strava/types';

export type LatLng = [number, number];
/** [lat, lng, elevationMeters] */
export type Pt3 = [number, number, number];
/** [lat, lng, elevationMeters, cumulativeDistanceMeters] */
export type Pt4 = [number, number, number, number];

const R = 6371000;
const rad = Math.PI / 180;

export function haversine(a: LatLng | number[], b: LatLng | number[]): number {
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const lineLength = (c: LatLng[]): number => c.slice(1).reduce((s, p, i) => s + haversine(c[i], p), 0);

/** Join ways sharing endpoints into chains, then order chains greedily from `start` (or the first). */
export function stitch(ways: LatLng[][], start?: LatLng): LatLng[] {
  const key = (p: LatLng) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const pool = ways.map((w) => w.slice());
  const chains: LatLng[][] = [];
  while (pool.length) {
    let chain = pool.pop() as LatLng[];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = pool.length - 1; i >= 0; i--) {
        const w = pool[i];
        const h = key(chain[0]);
        const t = key(chain[chain.length - 1]);
        if (key(w[0]) === t) chain = chain.concat(w.slice(1));
        else if (key(w[w.length - 1]) === t) chain = chain.concat(w.slice(0, -1).reverse());
        else if (key(w[w.length - 1]) === h) chain = w.slice(0, -1).concat(chain);
        else if (key(w[0]) === h) chain = w.slice(1).reverse().concat(chain);
        else continue;
        pool.splice(i, 1);
        grew = true;
      }
    }
    chains.push(chain);
  }
  // Drop tiny spur chains (< 2% of total length) unless that leaves nothing.
  const total = chains.reduce((s, c) => s + lineLength(c), 0);
  let kept = chains.filter((c) => lineLength(c) >= total * 0.02);
  if (!kept.length) kept = chains;
  // Greedy ordering: start at the chain endpoint nearest `start`, then hop to the nearest unvisited end.
  let cur: LatLng = start ?? kept[0][0];
  const out: LatLng[] = [];
  const rest = kept.slice();
  while (rest.length) {
    let best = 0;
    let bestRev = false;
    let bestD = Infinity;
    rest.forEach((c, i) => {
      const d0 = haversine(cur, c[0]);
      const d1 = haversine(cur, c[c.length - 1]);
      if (d0 < bestD) {
        bestD = d0;
        best = i;
        bestRev = false;
      }
      if (d1 < bestD) {
        bestD = d1;
        best = i;
        bestRev = true;
      }
    });
    const c = rest.splice(best, 1)[0];
    const seg = bestRev ? c.slice().reverse() : c;
    // A loop, not out.push(...seg): the spread overflows the call stack on very long ways (Appalachian Trail).
    for (const q of seg) out.push(q);
    cur = seg[seg.length - 1];
  }
  return out;
}

/** Interpolate a polyline to ~`stepM` spacing so DEM sampling follows terrain. */
export function densify(pts: LatLng[], stepM = 200): LatLng[] {
  const out: LatLng[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(haversine(a, b) / stepM));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Evenly thin to at most n points (keeps first and last). */
export function thin<T>(pts: T[], n: number): T[] {
  if (pts.length <= n) return pts;
  const out: T[] = [];
  for (let k = 0; k < n; k++) out.push(pts[Math.round((k * (pts.length - 1)) / (n - 1))]);
  return out;
}

/** Append cumulative distance (m), measured on the given (full-resolution) line. */
export function withDistance(pts: Array<LatLng | Pt3>): Pt4[] {
  let d = 0;
  return pts.map((p, i) => {
    if (i) d += haversine(pts[i - 1], p);
    return [p[0], p[1], (p[2] as number | undefined) ?? 0, d];
  });
}

/** Centered moving average (window w, odd). */
export function smooth(values: number[], w = 7): number[] {
  const h = Math.floor(w / 2);
  return values.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - h); k <= Math.min(values.length - 1, i + h); k++) {
      s += values[k];
      n++;
    }
    return s / n;
  });
}

/** Distance (m), gain (m: smoothed elevations, 10 m hysteresis) and high point (m, raw). */
export function routeStats(pts: Pt4[]): { dist: number; gain: number; hi: number } {
  const raw = pts.map((p) => p[2]);
  let hi = -Infinity;
  for (const e of raw) if (e > hi) hi = e;
  const ele = smooth(raw);
  // The moving average shrinks the ends toward the middle; pin them so a pure climb isn't under-counted.
  ele[0] = raw[0];
  ele[ele.length - 1] = raw[raw.length - 1];
  let gain = 0;
  let ref = ele[0];
  for (const e of ele) {
    if (e - ref > 10) {
      gain += e - ref;
      ref = e;
    } else if (ref - e > 10) ref = e;
  }
  return { dist: pts[pts.length - 1][3], gain, hi };
}

/** Mirror a path back to its start (out-and-back), continuing cumulative distance. */
export function mirror(pts: Pt4[]): Pt4[] {
  const total = pts[pts.length - 1][3];
  const back: Pt4[] = pts
    .slice(0, -1)
    .reverse()
    .map((p) => [p[0], p[1], p[2], 2 * total - p[3]]);
  return pts.concat(back);
}

/** Build the AdventureTrack the existing RouteMap / ElevationProfile render. Input [lat,lng,eleM,distM]. */
export function buildTrack(pts: Pt4[]): AdventureTrack {
  const eS = smooth(pts.map((p) => p[2]));
  const points: TrackPoint[] = pts.map((p, i) => {
    let grade = 0;
    if (i > 0 && i < pts.length - 1) {
      const dd = pts[i + 1][3] - pts[i - 1][3];
      if (dd >= 1) grade = Math.max(-50, Math.min(50, ((eS[i + 1] - eS[i - 1]) / dd) * 100));
    }
    return { lat: p[0], lng: p[1], alt: p[2], dist: p[3], grade, vel: 0, hr: 0 };
  });
  const ds = downsampleTrack(points, { epsilonMeters: 5, maxPoints: 800 });
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  const coordinates = ds.map((p) => [r5(p.lng), r5(p.lat)] as [number, number]);
  const lats = ds.map((p) => p.lat);
  const lngs = ds.map((p) => p.lng);
  const latlngs = thin(ds.map((p) => [p.lat, p.lng] as LatLng), 250);
  return {
    coordinates,
    altitude: ds.map((p) => Math.round(p.alt)),
    distance: ds.map((p) => Math.round(p.dist)),
    grade: ds.map((p) => Math.round(p.grade * 10) / 10),
    velocity: [],
    heartrate: [],
    summaryPolyline: encodePolyline(latlngs),
    bounds: {
      minLat: Math.min(...lats),
      minLng: Math.min(...lngs),
      maxLat: Math.max(...lats),
      maxLng: Math.max(...lngs),
    },
    pointCount: coordinates.length,
  };
}
