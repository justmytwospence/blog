import { describe, it, expect } from 'vitest';
import {
  computeTotals,
  getAllAdventures,
  getAdventureBySlug,
  getObjectives,
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
    syncedAt: '',
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

describe('read API against the committed snapshot', () => {
  it('lists the seeded adventures and resolves a report', () => {
    const slugs = getAllAdventures().map((a) => a.slug);
    expect(slugs).toContain('gold-hill');
    expect(slugs).toContain('lobo-peak');

    const gh = getAdventureBySlug('gold-hill');
    expect(gh).not.toBeNull();
    expect(gh?.title).toBe('Gold Hill');
    expect(gh?.sportType).toBe('TrailRun');
    expect(gh?.rating).toBe(4);
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

  it('exposes the seeded objectives, and only incomplete ones', () => {
    const { objectives } = getObjectives();
    expect(objectives.length).toBeGreaterThan(0);
    // The wishlist is forward-looking: completed objectives live as reports, not here.
    expect(objectives.every((o) => o.status === 'todo')).toBe(true);
    // Every objective should carry the fields the cards/map rely on.
    for (const o of objectives) {
      expect(o.slug).toBeTruthy();
      expect(o.title).toBeTruthy();
    }
  });
});
