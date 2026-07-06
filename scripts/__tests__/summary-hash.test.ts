import { describe, it, expect } from 'vitest';
import { summaryHash } from '../strava-shared';
import type { RawSummaryActivity, RawDetailedActivity } from '@blog/strava';

function summary(over: Partial<RawSummaryActivity> = {}): RawSummaryActivity {
  return {
    id: 42,
    name: 'Bear Peak',
    sport_type: 'TrailRun',
    start_date_local: '2025-08-14T07:00:00Z',
    distance: 1609.344,
    moving_time: 600,
    total_elevation_gain: 100,
    total_photo_count: 2,
    map: { summary_polyline: 'abc123' },
    workout_type: 0,
    ...over,
  };
}

describe('summaryHash (cheap change-detection)', () => {
  it('is deterministic for identical input', () => {
    expect(summaryHash(summary())).toBe(summaryHash(summary()));
  });

  it('changes when any summary-level field changes', () => {
    const base = summaryHash(summary());
    expect(summaryHash(summary({ name: 'Green Mountain' }))).not.toBe(base);
    expect(summaryHash(summary({ distance: 1700 }))).not.toBe(base);
    expect(summaryHash(summary({ moving_time: 900 }))).not.toBe(base);
    expect(summaryHash(summary({ total_elevation_gain: 250 }))).not.toBe(base);
    expect(summaryHash(summary({ start_date_local: '2025-08-15T07:00:00Z' }))).not.toBe(base);
    expect(summaryHash(summary({ map: { summary_polyline: 'zzz999' } }))).not.toBe(base);
    expect(summaryHash(summary({ total_photo_count: 5 }))).not.toBe(base);
    expect(summaryHash(summary({ sport_type: 'Hike' }))).not.toBe(base);
    expect(summaryHash(summary({ workout_type: 1 }))).not.toBe(base); // race flag flips the hash
  });

  it('ignores a description-only edit (detail-only field is not in the summary hash)', () => {
    // The whole point: a description edit must NOT trigger a detail re-fetch.
    const a: RawDetailedActivity = { ...summary(), elapsed_time: 700, description: 'first attempt' };
    const b: RawDetailedActivity = { ...summary(), elapsed_time: 700, description: 'REVISED writeup' };
    expect(summaryHash(a)).toBe(summaryHash(b));
  });
});
