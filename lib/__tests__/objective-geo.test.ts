import { describe, it, expect } from 'vitest';
import { decodePolyline } from '@blog/strava';
import { stitch, withDistance, routeStats, buildTrack, haversine, type LatLng, type Pt4 } from '../objective-geo';

describe('stitch', () => {
  it('joins two ways sharing an endpoint, one reversed', () => {
    const a: LatLng[] = [[0, 0], [0, 0.001], [0, 0.002]];
    const b: LatLng[] = [[0, 0.004], [0, 0.003], [0, 0.002]]; // shares a's last point, runs the other way
    const out = stitch([a, b], [0, 0]);
    expect(out).toHaveLength(a.length + b.length - 1);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([0, 0.004]);
  });

  it('does not overflow the call stack on a very long single way', () => {
    const big: LatLng[] = Array.from({ length: 100_000 }, (_, i) => [i * 1e-5, 0]);
    expect(() => stitch([big])).not.toThrow();
    expect(stitch([big])).toHaveLength(100_000);
  });
});

describe('withDistance', () => {
  it('accumulates distance on the full line', () => {
    const line: LatLng[] = [[0, 0], [0, 0.01], [0.01, 0.01]];
    const pts = withDistance(line);
    expect(pts[0][3]).toBe(0);
    expect(pts[1][3]).toBeGreaterThan(0);
    expect(pts[2][3]).toBeGreaterThan(pts[1][3]);
    expect(pts[2][3]).toBeCloseTo(haversine(line[0], line[1]) + haversine(line[1], line[2]), 3);
  });
});

describe('routeStats', () => {
  const mk = (eles: number[]): Pt4[] => eles.map((e, i) => [0, i * 1e-4, e, i * 11.1]);

  it('ignores DEM noise under the hysteresis', () => {
    const noisy = mk(Array.from({ length: 60 }, (_, i) => (i % 2 ? 5 : 0)));
    expect(routeStats(noisy).gain).toBe(0);
  });

  it('measures a monotone climb', () => {
    const climb = mk(Array.from({ length: 101 }, (_, i) => i * 10));
    const { gain, hi } = routeStats(climb);
    expect(gain).toBeGreaterThan(990);
    expect(gain).toBeLessThan(1010);
    expect(hi).toBe(1000);
  });
});

describe('buildTrack', () => {
  const pts: Pt4[] = Array.from({ length: 300 }, (_, i) => [
    40 + i * 1e-4,
    -105 + i * 1e-4,
    1500 + 300 * Math.sin(i / 20),
    i * 15,
  ]);

  it('produces aligned channels in [lng, lat] order', () => {
    const t = buildTrack(pts);
    expect(t.altitude).toHaveLength(t.coordinates.length);
    expect(t.distance).toHaveLength(t.coordinates.length);
    expect(t.grade).toHaveLength(t.coordinates.length);
    expect(t.pointCount).toBe(t.coordinates.length);
    expect(t.coordinates[0][0]).toBeCloseTo(-105, 3); // lng first
    expect(t.coordinates[0][1]).toBeCloseTo(40, 3);
  });

  it('encodes a usable summary polyline', () => {
    const t = buildTrack(pts);
    expect(decodePolyline(t.summaryPolyline as string).length).toBeGreaterThanOrEqual(2);
  });
});
