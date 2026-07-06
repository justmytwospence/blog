import { describe, it, expect } from 'vitest';
import { mapSportType, buildPhotosFromRaw, transformDetailToActivity } from '../src/transform';
import type { RawDetailedActivity, RawStreamSet, RawPhoto } from '../src/types';

const META = { sourceHash: 'abc' };

function baseDetail(overrides: Partial<RawDetailedActivity> = {}): RawDetailedActivity {
  return {
    id: 1,
    name: 'Test',
    sport_type: 'TrailRun',
    start_date_local: '2025-08-14T07:00:00Z',
    distance: 1609.344,
    moving_time: 600,
    elapsed_time: 700,
    total_elevation_gain: 100,
    ...overrides,
  };
}

describe('mapSportType', () => {
  it('maps known sport types', () => {
    expect(mapSportType('TrailRun')).toBe('TrailRun');
    expect(mapSportType('GravelRide')).toBe('GravelRide');
    expect(mapSportType('BackcountrySki')).toBe('BackcountrySki');
  });
  it('falls back to Other for unknown/empty', () => {
    expect(mapSportType('Pickleball')).toBe('Other');
    expect(mapSportType(undefined)).toBe('Other');
  });
});

describe('buildPhotosFromRaw', () => {
  it('extracts the largest url and geotag', () => {
    const raw: RawPhoto[] = [
      { unique_id: 'p1', urls: { '100': 'small.jpg', '2000': 'big.jpg' }, location: [36.5, -105.5], caption: 'hi' },
      { unique_id: 'p2', urls: {} },
    ];
    const out = buildPhotosFromRaw(raw);
    expect(out).toHaveLength(1);
    expect(out[0].sourceUrl).toBe('big.jpg');
    expect(out[0].lat).toBe(36.5);
    expect(out[0].lng).toBe(-105.5);
    expect(out[0].caption).toBe('hi');
  });
});

describe('transformDetailToActivity', () => {
  it('maps SI stats and derives date + url', () => {
    const a = transformDetailToActivity(baseDetail({ average_heartrate: 140 }), null, null, [], META);
    expect(a.stats.distanceMeters).toBe(1609.344);
    expect(a.stats.avgHeartrate).toBe(140);
    expect(a.date).toBe('2025-08-14');
    expect(a.stravaUrl).toBe('https://www.strava.com/activities/1');
    expect(a.sourceHash).toBe('abc');
  });

  it('is null-safe for missing heart rate / power', () => {
    const a = transformDetailToActivity(baseDetail(), null, null, [], META);
    expect(a.stats.avgHeartrate).toBeNull();
    expect(a.stats.avgWatts).toBeNull();
  });

  it('builds a track from latlng + altitude streams (coordinates as [lng,lat])', () => {
    const streams: RawStreamSet = {
      latlng: { data: [[36.5, -105.5], [36.51, -105.49], [36.52, -105.48]] },
      altitude: { data: [3000, 3100, 3200] },
      distance: { data: [0, 500, 1000] },
    };
    const a = transformDetailToActivity(baseDetail({ map: { summary_polyline: 'x' } }), streams, null, [], META);
    expect(a.track).not.toBeNull();
    expect(a.track!.coordinates[0]).toEqual([-105.5, 36.5]);
    expect(a.track!.altitude.length).toBeGreaterThan(0);
    expect(a.track!.bounds).not.toBeNull();
  });

  it('returns track null when there is no geometry at all', () => {
    const a = transformDetailToActivity(baseDetail(), null, null, [], META);
    expect(a.track).toBeNull();
  });

  it('carries workout_type and both hashes through for change-detection + race derivation', () => {
    const a = transformDetailToActivity(baseDetail({ workout_type: 1 }), null, null, [], {
      sourceHash: 'src',
      summaryHash: 'sum',
    });
    expect(a.workoutType).toBe(1); // Run race → drives isRace
    expect(a.sourceHash).toBe('src');
    expect(a.summaryHash).toBe('sum');
  });

  it('defaults workoutType to null and summaryHash to undefined when absent', () => {
    const a = transformDetailToActivity(baseDetail(), null, null, [], META);
    expect(a.workoutType).toBeNull();
    expect(a.summaryHash).toBeUndefined();
  });
});
