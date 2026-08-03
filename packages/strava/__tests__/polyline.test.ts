import { describe, it, expect } from 'vitest';
import { decodePolyline, encodePolyline, downsampleTrack, type TrackPoint } from '../src/polyline';

describe('decodePolyline', () => {
  it('decodes the canonical Google example', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(coords).toHaveLength(3);
    expect(coords[0][0]).toBeCloseTo(38.5, 4);
    expect(coords[0][1]).toBeCloseTo(-120.2, 4);
    expect(coords[2][0]).toBeCloseTo(43.252, 3);
    expect(coords[2][1]).toBeCloseTo(-126.453, 3);
  });

  it('returns [] for empty input', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

function pt(lat: number, lng: number): TrackPoint {
  return { lat, lng, alt: 0, dist: 0, grade: 0, vel: 0, hr: 0 };
}

describe('downsampleTrack', () => {
  it('is a no-op for <= 2 points', () => {
    const pts = [pt(0, 0), pt(1, 1)];
    expect(downsampleTrack(pts)).toHaveLength(2);
  });

  it('drops near-collinear interior points and keeps endpoints', () => {
    // A straight line of 5 points — RDP should keep only the two endpoints.
    const pts = [pt(0, 0), pt(0, 0.001), pt(0, 0.002), pt(0, 0.003), pt(0, 0.004)];
    const ds = downsampleTrack(pts, { epsilonMeters: 8 });
    expect(ds).toHaveLength(2);
    expect(ds[0]).toEqual(pts[0]);
    expect(ds[ds.length - 1]).toEqual(pts[pts.length - 1]);
  });

  it('enforces the hard point cap', () => {
    const pts: TrackPoint[] = [];
    for (let i = 0; i < 5000; i++) pts.push(pt(Math.sin(i / 50) * 0.05, (i / 5000) * 0.1));
    const ds = downsampleTrack(pts, { epsilonMeters: 0.0001, maxPoints: 500 });
    expect(ds.length).toBeLessThanOrEqual(500);
    expect(ds[0]).toEqual(pts[0]);
    expect(ds[ds.length - 1]).toEqual(pts[pts.length - 1]);
  });
});

describe('encodePolyline', () => {
  it('round-trips through decodePolyline to 5dp', () => {
    // Kept despite losing its last caller when the manual importers were deleted: it is the pure
    // inverse of decodePolyline and what any future non-Strava importer would need.
    const pts: Array<[number, number]> = [
      [39.9, -105.3],
      [39.90123, -105.30456],
      [40.01, -105.51],
    ];
    const round = decodePolyline(encodePolyline(pts));
    expect(round).toHaveLength(pts.length);
    round.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(pts[i][0], 5);
      expect(lng).toBeCloseTo(pts[i][1], 5);
    });
  });

  it('round-trips an empty track', () => {
    expect(decodePolyline(encodePolyline([]))).toEqual([]);
  });
});
