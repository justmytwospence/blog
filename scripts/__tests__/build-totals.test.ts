import { describe, it, expect } from 'vitest';
import { buildTotals } from '../build-totals';
import type { AllActivityEntry } from '@blog/strava';

const E = (over: Partial<AllActivityEntry>): AllActivityEntry => ({
  id: 1,
  date: '2020-03-01',
  startEpoch: 0,
  sport: 'TrailRun',
  distanceMeters: 1000,
  movingTimeSeconds: 600,
  elevationGainMeters: 100,
  trainer: false,
  commute: false,
  poolSwim: false,
  ...over,
});

const ENTRIES: AllActivityEntry[] = [
  E({ id: 1, date: '2020-03-01', distanceMeters: 10000, movingTimeSeconds: 3600, elevationGainMeters: 500 }),
  E({ id: 2, date: '2020-03-01', distanceMeters: 5000, movingTimeSeconds: 1800, elevationGainMeters: 200 }),
  E({ id: 3, date: '2021-06-15', sport: 'Ride', distanceMeters: 40000, movingTimeSeconds: 7200, elevationGainMeters: 300 }),
  E({ id: 4, sport: 'VirtualRide', distanceMeters: 99999 }), // indoor → excluded
  E({ id: 5, sport: 'Ride', trainer: true, distanceMeters: 99999 }), // trainer → excluded
  E({ id: 6, sport: 'Run', commute: true, distanceMeters: 99999 }), // commute → excluded
  E({ id: 7, sport: 'Swim', poolSwim: true, distanceMeters: 99999 }), // pool → excluded
];

describe('buildTotals', () => {
  const { lifetime, yearly } = buildTotals(ENTRIES);

  it('counts only human-powered activities', () => {
    expect(lifetime.activityCount).toBe(3);
    expect(lifetime.totalDistanceMeters).toBe(55000);
    expect(lifetime.totalMovingTimeSeconds).toBe(12600);
    expect(lifetime.totalElevationGainMeters).toBe(1000);
  });

  it('groups bySport (mapped) sorted by distance', () => {
    expect(lifetime.bySport.map((s) => s.sportType)).toEqual(['Ride', 'TrailRun']);
    const tr = lifetime.bySport.find((s) => s.sportType === 'TrailRun')!;
    expect(tr).toMatchObject({ count: 2, distanceMeters: 15000, movingTimeSeconds: 5400, elevationGainMeters: 700 });
  });

  it('breaks down by year and month', () => {
    expect(lifetime.byYearSport['2020'].TrailRun.distanceMeters).toBe(15000);
    expect(lifetime.byYearSport['2021'].Ride.distanceMeters).toBe(40000);
    expect(lifetime.byMonthSport['2020-03'].TrailRun.movingTimeSeconds).toBe(5400);
    expect(lifetime.byMonthSport['2021-06'].Ride.distanceMeters).toBe(40000);
  });

  it('builds cumulative-by-day-of-year points with a time axis', () => {
    // Both 2020 activities share a day-of-year → one merged, cumulative point.
    expect(yearly.years['2020']).toEqual([{ doy: 61, distM: 15000, gainM: 700, timeS: 5400 }]);
    expect(yearly.years['2021']).toEqual([{ doy: 166, distM: 40000, gainM: 300, timeS: 7200 }]);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildTotals(ENTRIES))).toBe(JSON.stringify(buildTotals(ENTRIES)));
  });
});
