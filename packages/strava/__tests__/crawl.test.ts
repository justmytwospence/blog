import { describe, it, expect } from 'vitest';
import { toEntry } from '../src/crawl';
import type { RawSummaryActivity } from '../src/types';

const raw = (over: Partial<RawSummaryActivity> = {}): RawSummaryActivity => ({
  id: 42,
  name: 'Paulina Peak',
  start_date_local: '2026-08-02T16:13:50Z',
  distance: 6971.9,
  moving_time: 3534,
  total_elevation_gain: 474,
  sport_type: 'TrailRun',
  ...over,
});

describe('toEntry', () => {
  it('carries the summit elevation and photo count off the summary endpoint', () => {
    const e = toEntry(raw({ elev_high: 2438.6, total_photo_count: 4 }));
    expect(e.elevHighMeters).toBe(2438.6);
    expect(e.totalPhotoCount).toBe(4);
  });

  it('defaults the new fields when Strava omits them', () => {
    // Indoor and manual entries have no elevation profile; older index rows predate the fields.
    const e = toEntry(raw());
    expect(e.elevHighMeters).toBeNull();
    expect(e.totalPhotoCount).toBe(0);
  });

  it('maps null elev_high to null rather than 0', () => {
    // 0 would read as sea level and pass a --min-high filter of 0.
    expect(toEntry(raw({ elev_high: null })).elevHighMeters).toBeNull();
  });

  it('preserves the pre-existing field mapping', () => {
    const e = toEntry(raw({ trainer: true, commute: true, start_latlng: [43.7008, -121.2724] }));
    expect(e.id).toBe(42);
    expect(e.date).toBe('2026-08-02');
    expect(e.sport).toBe('TrailRun');
    expect(e.distanceMeters).toBe(6972); // rounded
    expect(e.movingTimeSeconds).toBe(3534);
    expect(e.elevationGainMeters).toBe(474);
    expect(e.trainer).toBe(true);
    expect(e.commute).toBe(true);
    expect(e.name).toBe('Paulina Peak');
    expect(e.startLat).toBeCloseTo(43.7008, 4);
    expect(e.startLng).toBeCloseTo(-121.2724, 4);
  });

  it('falls back through sport_type -> type -> Workout', () => {
    expect(toEntry(raw({ sport_type: undefined, type: 'Run' })).sport).toBe('Run');
    expect(toEntry(raw({ sport_type: undefined, type: undefined })).sport).toBe('Workout');
  });

  it('nulls the start point when Strava returns an empty latlng', () => {
    const e = toEntry(raw({ start_latlng: [] }));
    expect(e.startLat).toBeNull();
    expect(e.startLng).toBeNull();
  });
});
