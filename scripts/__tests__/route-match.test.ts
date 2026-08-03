import { describe, it, expect } from 'vitest';
import {
  haversine,
  median,
  bucketOf,
  groupRoutes,
  matchRoute,
  RADIUS_M,
  type SnapStart,
  type RouteGroup,
} from '../route-match';

describe('haversine', () => {
  it('is zero for identical points', () => {
    expect(haversine(40, -105, 40, -105)).toBe(0);
  });

  it('gives ~111 km for one degree of latitude', () => {
    expect(haversine(40, -105, 41, -105)).toBeGreaterThan(110_000);
    expect(haversine(40, -105, 41, -105)).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    expect(haversine(40, -105, 39.5, -105.5)).toBeCloseTo(haversine(39.5, -105.5, 40, -105), 6);
  });

  it('does not NaN on antipodal points', () => {
    // The Math.min(1, ...) clamp guards asin() against float overshoot.
    expect(Number.isFinite(haversine(0, 0, 0, 180))).toBe(true);
  });

  it('measures a parking-lot-scale offset in the tens of metres', () => {
    // ~0.001 deg latitude ≈ 111 m — the scale RADIUS_M is calibrated to.
    const d = haversine(39.9, -105.3, 39.901, -105.3);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe('median', () => {
  it('handles odd, even and single-element inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it('does not mutate its input', () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('bucketOf', () => {
  it('buckets foot sports together, including the site-only Scramble', () => {
    for (const s of ['TrailRun', 'Run', 'Hike', 'Walk', 'Snowshoe', 'Mountaineering', 'RockClimbing', 'Scramble']) {
      expect(bucketOf(s)).toBe('foot');
    }
  });

  it('separates bike, ski and nordic', () => {
    expect(bucketOf('Ride')).toBe('bike');
    expect(bucketOf('BackcountrySki')).toBe('ski');
    expect(bucketOf('NordicSki')).toBe('nordic');
  });

  it('passes an unmapped sport through as its own bucket', () => {
    expect(bucketOf('Kayaking')).toBe('Kayaking');
  });
});

/** Snapshot stub: ids 1-3 near one trailhead on foot, 4 on skis, 5 unresolvable. */
const snapOf = (id: number): SnapStart =>
  ({
    1: { start: [39.9000, -105.3000] as [number, number], bucket: 'foot' },
    2: { start: [39.9002, -105.3000] as [number, number], bucket: 'foot' },
    3: { start: [39.9004, -105.3000] as [number, number], bucket: 'foot' },
    4: { start: [39.9002, -105.3000] as [number, number], bucket: 'ski' },
    5: { start: null, bucket: null },
  })[id] ?? { start: null, bucket: null };

describe('groupRoutes', () => {
  it('merges members sharing a group key and takes the median trailhead', () => {
    const groups = groupRoutes(
      [
        { group: 'bear-peak', laps: false, ids: [1] },
        { group: 'bear-peak', laps: false, ids: [2, 3] },
      ],
      snapOf,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('bear-peak');
    expect(groups[0].trailhead[0]).toBeCloseTo(39.9002, 4); // median of the three
  });

  it('ORs the laps flag across members', () => {
    const groups = groupRoutes(
      [
        { group: 'eldora', laps: false, ids: [1] },
        { group: 'eldora', laps: true, ids: [2] },
      ],
      snapOf,
    );
    expect(groups[0].laps).toBe(true);
  });

  it('collects every member bucket', () => {
    const groups = groupRoutes([{ group: 'mixed', laps: false, ids: [1, 4] }], snapOf);
    expect([...groups[0].buckets].sort()).toEqual(['foot', 'ski']);
  });

  it('drops a group whose members have no resolvable start', () => {
    expect(groupRoutes([{ group: 'ghost', laps: false, ids: [5] }], snapOf)).toHaveLength(0);
  });

  it('keeps distinct groups separate', () => {
    const groups = groupRoutes(
      [
        { group: 'a', laps: false, ids: [1] },
        { group: 'b', laps: false, ids: [4] },
      ],
      snapOf,
    );
    expect(groups.map((g) => g.key).sort()).toEqual(['a', 'b']);
  });
});

const GROUPS: RouteGroup[] = [
  { key: 'bear-peak', trailhead: [39.9, -105.3], buckets: new Set(['foot']), laps: false },
  { key: 'eldora', trailhead: [39.9372, -105.5827], buckets: new Set(['ski']), laps: true },
];

describe('matchRoute', () => {
  it('matches a start inside the radius with the right bucket', () => {
    expect(matchRoute(GROUPS, 39.9, -105.3, 'TrailRun')).toEqual({ group: 'bear-peak', laps: false });
  });

  it('carries the route laps flag through', () => {
    expect(matchRoute(GROUPS, 39.9372, -105.5827, 'BackcountrySki')).toEqual({ group: 'eldora', laps: true });
  });

  it('rejects the right place in the wrong sport bucket', () => {
    // The whole point: an Eldora ski morning must not match a foot route at the same trailhead.
    expect(matchRoute(GROUPS, 39.9, -105.3, 'BackcountrySki')).toBeNull();
  });

  it('rejects a start beyond the radius', () => {
    // ~1.1 km north, comfortably outside RADIUS_M.
    expect(matchRoute(GROUPS, 39.91, -105.3, 'TrailRun')).toBeNull();
  });

  it('accepts just inside and rejects just outside the radius', () => {
    const inside = 39.9 + (RADIUS_M * 0.9) / 111_320;
    const outside = 39.9 + (RADIUS_M * 1.1) / 111_320;
    expect(matchRoute(GROUPS, inside, -105.3, 'Hike')).not.toBeNull();
    expect(matchRoute(GROUPS, outside, -105.3, 'Hike')).toBeNull();
  });

  it('picks the nearest of two candidates in the same bucket', () => {
    const groups: RouteGroup[] = [
      { key: 'far', trailhead: [39.9020, -105.3], buckets: new Set(['foot']), laps: false },
      { key: 'near', trailhead: [39.9001, -105.3], buckets: new Set(['foot']), laps: false },
    ];
    expect(matchRoute(groups, 39.9, -105.3, 'Hike')?.group).toBe('near');
  });

  it('returns null with no groups', () => {
    expect(matchRoute([], 39.9, -105.3, 'Hike')).toBeNull();
  });
});
