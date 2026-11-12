import { describe, it, expect } from 'vitest';
import {
  computeTotals,
  deriveIsRace,
  getAllAdventures,
  getAdventureBySlug,
  getObjectiveCatalog,
} from '../adventures';
import type { AdventureActivity, AdventureStats } from '@blog/strava/types';

function act(over: Partial<AdventureStats>, id = 1): AdventureActivity {
  const stats: AdventureStats = {
    distanceMeters: 0,
    movingTimeSeconds: 0,
    elapsedTimeSeconds: 0,
    elevationGainMeters: 0,
    elevHighMeters: null,
    elevLowMeters: null,
    avgSpeedMetersPerSec: 0,
    maxSpeedMetersPerSec: 0,
    avgHeartrate: null,
    maxHeartrate: null,
    avgCadence: null,
    avgWatts: null,
    maxWatts: null,
    calories: null,
    sufferScore: null,
    ...over,
  };
  return {
    stravaId: id,
    name: 'x',
    sportType: 'Hike',
    startLocal: '',
    date: '2025-01-01',
    timezone: null,
    location: { city: null, state: null, country: null },
    stats,
    track: null,
    weather: null,
    photos: [],
    gear: null,
    description: null,
    stravaUrl: '',
    sourceHash: '',
  };
}

describe('computeTotals (multi-day aggregation)', () => {
  it('passes a single activity through unchanged', () => {
    const a = act({ distanceMeters: 5000 });
    expect(computeTotals([a])).toBe(a.stats);
  });

  it('sums, takes extremes, and weights means by moving time', () => {
    const t = computeTotals([
      act({ distanceMeters: 10000, movingTimeSeconds: 3600, elevationGainMeters: 500, elevHighMeters: 3000, elevLowMeters: 2500, maxSpeedMetersPerSec: 4, avgHeartrate: 140, maxHeartrate: 160, calories: 800 }),
      act({ distanceMeters: 20000, movingTimeSeconds: 7200, elevationGainMeters: 1500, elevHighMeters: 3500, elevLowMeters: 2400, maxSpeedMetersPerSec: 5, avgHeartrate: 150, maxHeartrate: 170, calories: 1600 }, 2),
    ]);
    expect(t.distanceMeters).toBe(30000);
    expect(t.elevationGainMeters).toBe(2000);
    expect(t.elevHighMeters).toBe(3500);
    expect(t.elevLowMeters).toBe(2400);
    expect(t.maxHeartrate).toBe(170);
    expect(t.maxSpeedMetersPerSec).toBe(5);
    expect(t.calories).toBe(2400);
    expect(t.avgSpeedMetersPerSec).toBeCloseTo(30000 / 10800, 5);
    // time-weighted HR = (140*3600 + 150*7200) / 10800
    expect(t.avgHeartrate).toBeCloseTo(146.667, 2);
  });
});

describe('deriveIsRace (workout_type → race, frontmatter overrides)', () => {
  const run = (wt: number | null | undefined) => [{ workoutType: wt }];

  it('derives race from Strava workout_type 1 (run) and 11 (ride)', () => {
    expect(deriveIsRace(undefined, run(1))).toBe(true);
    expect(deriveIsRace(undefined, run(11))).toBe(true);
  });

  it('is not a race for non-race / missing workout_type', () => {
    expect(deriveIsRace(undefined, run(0))).toBe(false);
    expect(deriveIsRace(undefined, run(10))).toBe(false);
    expect(deriveIsRace(undefined, run(null))).toBe(false);
    expect(deriveIsRace(undefined, run(undefined))).toBe(false);
    expect(deriveIsRace(undefined, [])).toBe(false);
  });

  it('any member being a race makes the adventure a race', () => {
    expect(deriveIsRace(undefined, [{ workoutType: 0 }, { workoutType: 1 }])).toBe(true);
  });

  it('an explicit frontmatter flag overrides the derivation both ways', () => {
    expect(deriveIsRace(true, run(0))).toBe(true); // non-run/ride race (triathlon)
    expect(deriveIsRace(false, run(1))).toBe(false); // force off despite workout_type
  });
});

describe('read API against the committed snapshot', () => {
  it('lists the seeded adventures and resolves a report', () => {
    const slugs = getAllAdventures().map((a) => a.slug);
    expect(slugs).toContain('gold-hill');
    expect(slugs).toContain('lobo-peak');

    const gh = getAdventureBySlug('gold-hill');
    expect(gh).not.toBeNull();
    expect(gh?.title).toBe('Gold Hill');
    expect(gh?.sportType).toBe('TrailRun');
    // Gold Hill is the seed example but not a featured highlight (those are PCT/CO Trail/Wonderland).
    expect(gh?.featured).toBe(false);
    expect(gh?.totals.distanceMeters).toBeGreaterThan(16000);
    expect(gh?.allPhotos.length).toBe(3);
    expect(gh?.coverPhoto).not.toBeNull();
    expect(gh?.coverPhoto?.thumb).toContain('/adventures/18893341377/');
  });

  it('returns null for an unknown slug', () => {
    expect(getAdventureBySlug('does-not-exist')).toBeNull();
  });

  it('builds the public objectives catalog with done items linked to reports', () => {
    const items = getObjectiveCatalog();
    const by = new Map(items.map((i) => [i.slug, i]));
    expect(items).toHaveLength(284);

    // Every item places on the map: explicit point, or derived from its report.
    expect(items.filter((i) => i.lat == null || i.lng == null).map((i) => i.slug)).toEqual([]);

    const fourteeners = items.filter((i) => i.page === 'peaks' && i.sections.includes('14ers'));
    expect(fourteeners).toHaveLength(71);
    expect(fourteeners.filter((i) => i.done)).toHaveLength(59);

    // One peak can sit in several sections of its page.
    const rainier = by.get('mount-rainier');
    expect(rainier).toMatchObject({ done: true, reportSlug: 'rainier-kautz' });
    expect(rainier?.sections).toEqual(
      expect.arrayContaining(['14ers', 'cascade-volcanoes', 'state-high-points']),
    );

    // Completion by an explicit `objective:` link on the report (no completed_by in the file).
    expect(by.get('colorado-trail')).toMatchObject({ done: true, reportSlug: 'colorado-trail' });
    // A report whose slug merely matches does not complete the objective.
    expect(by.get('pikes-peak-cycle-to-the-summit')?.done).toBe(false);
    // The Natchez Trace report is one 40-mile day, not the 444-mile parkway.
    expect(by.get('natchez-trace')?.done).toBe(false);

    // A source:'pct' import has no altitude channel: the point falls back to the track midpoint.
    const pct = by.get('pacific-crest-trail');
    expect(pct?.done).toBe(true);
    expect(pct?.polylines.length).toBeGreaterThan(0);
    expect(pct?.lat).toBeGreaterThan(32);
    expect(pct?.lat).toBeLessThan(49);
  });
});

// Pins on real committed content for the derivations this refactor moved out of lib/adventures.
// These are the branches most likely to drift silently: a wrong peakClass also corrupts `facets`,
// which drives the library's category filter.
describe('derivation pins against real content', () => {
  it('badges a 14er by elevation', () => {
    const a = getAdventureBySlug('mount-elbert');
    expect(a?.peakClass).toBe('14er');
    expect(a?.facets).toContain('14er');
  });

  it('does NOT badge a thru-hike that crosses above 13,000 ft', () => {
    // Pacific Crest Trail tops out at 13,153 ft but bags no peak.
    const a = getAdventureBySlug('pacific-crest-trail');
    expect(a?.type).toBe('thru-hike');
    expect(a?.peakClass).toBeNull();
    expect(a?.facets).not.toContain('13er');
  });

  it('keeps the site-only Scramble sport label', () => {
    // Scramble is not a Strava sport_type; it survives only via the validated `sport:` override.
    const scrambles = getAllAdventures().filter((a) => a.sportType === 'Scramble');
    expect(scrambles.length).toBeGreaterThan(0);
  });

  it('emits only known facets', () => {
    const known = new Set(['14er', '13er', 'race', 'duathlon', 'couloir', 'scramble', 'traverse', 'thru-hike']);
    for (const a of getAllAdventures()) {
      for (const f of a.facets) expect(known.has(f)).toBe(true);
    }
  });
});
