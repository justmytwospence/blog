import { describe, it, expect } from 'vitest';
import { filterActivities, formatTable } from '../adventure-find';
import type { AllActivityEntry } from '@blog/strava';

const E = (over: Partial<AllActivityEntry>): AllActivityEntry => ({
  id: 1,
  date: '2026-07-15',
  startEpoch: 0,
  sport: 'TrailRun',
  distanceMeters: 10_000,
  movingTimeSeconds: 3600,
  elevationGainMeters: 500,
  trainer: false,
  commute: false,
  poolSwim: false,
  name: 'x',
  startLat: null,
  startLng: null,
  elevHighMeters: 2000,
  totalPhotoCount: 0,
  ...over,
});

const ENTRIES: AllActivityEntry[] = [
  E({ id: 1, date: '2026-07-10', name: 'oldest' }),
  E({ id: 2, date: '2026-07-15', name: 'middle', totalPhotoCount: 3 }),
  E({ id: 3, date: '2026-07-20', name: 'newest', sport: 'BackcountrySki', elevHighMeters: 3500 }),
];

describe('filterActivities — dates', () => {
  it('returns everything, newest first, with no filters', () => {
    expect(filterActivities(ENTRIES, {}).map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it('treats --after as inclusive', () => {
    expect(filterActivities(ENTRIES, { after: '2026-07-15' }).map((e) => e.id)).toEqual([3, 2]);
  });

  it('treats --before as inclusive', () => {
    expect(filterActivities(ENTRIES, { before: '2026-07-15' }).map((e) => e.id)).toEqual([2, 1]);
  });

  it('combines both bounds', () => {
    expect(filterActivities(ENTRIES, { after: '2026-07-15', before: '2026-07-15' }).map((e) => e.id)).toEqual([2]);
  });
});

describe('filterActivities — sport', () => {
  it('matches the raw Strava sport_type, case-insensitively', () => {
    expect(filterActivities(ENTRIES, { sports: ['trailrun'] }).map((e) => e.id)).toEqual([2, 1]);
  });

  it('matches a mapped SportType name', () => {
    expect(filterActivities(ENTRIES, { sports: ['BackcountrySki'] }).map((e) => e.id)).toEqual([3]);
  });

  it('accepts several sports at once', () => {
    expect(filterActivities(ENTRIES, { sports: ['TrailRun', 'BackcountrySki'] })).toHaveLength(3);
  });

  it('matches nothing for an unknown sport', () => {
    expect(filterActivities(ENTRIES, { sports: ['Pickleball'] })).toHaveLength(0);
  });
});

describe('filterActivities — thresholds', () => {
  it('applies minimums inclusively', () => {
    expect(filterActivities([E({ elevationGainMeters: 500 })], { minGainMeters: 500 })).toHaveLength(1);
    expect(filterActivities([E({ elevationGainMeters: 499 })], { minGainMeters: 500 })).toHaveLength(0);
    expect(filterActivities([E({ distanceMeters: 10_000 })], { minDistanceMeters: 10_000 })).toHaveLength(1);
    expect(filterActivities([E({ elevHighMeters: 2000 })], { minElevHighMeters: 2000 })).toHaveLength(1);
  });

  it('filters on photos', () => {
    expect(filterActivities(ENTRIES, { withPhotos: true }).map((e) => e.id)).toEqual([2]);
  });
});

describe('filterActivities — unpublished', () => {
  it('excludes ids already referenced by a companion', () => {
    const published = new Set([2, 3]);
    expect(filterActivities(ENTRIES, { unpublishedOnly: true }, published).map((e) => e.id)).toEqual([1]);
  });

  it('ignores publishedIds unless the flag is set', () => {
    expect(filterActivities(ENTRIES, {}, new Set([1, 2, 3]))).toHaveLength(3);
  });
});

describe('filterActivities — stale index rows', () => {
  it('does not throw when the new fields are absent, and excludes them from --min-high', () => {
    // Rows written before the index carried elevHighMeters/totalPhotoCount.
    const stale = [{ ...E({ id: 9 }), elevHighMeters: undefined, totalPhotoCount: undefined }] as unknown as AllActivityEntry[];
    expect(() => filterActivities(stale, {})).not.toThrow();
    expect(filterActivities(stale, {})).toHaveLength(1);
    expect(filterActivities(stale, { minElevHighMeters: 1 })).toHaveLength(0);
    expect(filterActivities(stale, { withPhotos: true })).toHaveLength(0);
  });

  it('treats a null summit elevation as failing --min-high, not as zero-and-pass', () => {
    expect(filterActivities([E({ elevHighMeters: null })], { minElevHighMeters: 1 })).toHaveLength(0);
  });
});

describe('filterActivities — ordering and limit', () => {
  it('breaks same-date ties by id descending, for a stable ordering', () => {
    const same = [E({ id: 5, date: '2026-07-01' }), E({ id: 7, date: '2026-07-01' })];
    expect(filterActivities(same, {}).map((e) => e.id)).toEqual([7, 5]);
  });

  it('truncates after sorting, so the limit keeps the newest', () => {
    expect(filterActivities(ENTRIES, { limit: 2 }).map((e) => e.id)).toEqual([3, 2]);
  });
});

describe('formatTable', () => {
  it('renders imperial units and an em dash for a missing summit', () => {
    const out = formatTable([E({ id: 1, name: 'Paulina Peak', elevHighMeters: null, totalPhotoCount: 4 })]);
    expect(out).toContain('Paulina Peak');
    expect(out).toContain('6.2 mi'); // 10 km
    expect(out).toContain('—');
    expect(out.split('\n')[0]).toContain('HIGH');
  });
});
