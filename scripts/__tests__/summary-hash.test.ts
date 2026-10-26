import { describe, it, expect } from 'vitest';
import {
  keptPhotoFiles,
  sourceHash,
  stalePhotoFiles,
  summaryHash,
  summaryHashV1,
} from '../strava-shared';
import type { RawSummaryActivity, RawDetailedActivity, RawPhoto } from '@blog/strava';

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
    gear_id: 'g123',
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
    expect(summaryHash(summary({ gear_id: 'g999' }))).not.toBe(base); // shoe/bike swap
  });

  it('ignores a description-only edit (detail-only field is not in the summary hash)', () => {
    // The whole point: a description edit must NOT trigger a detail re-fetch.
    const a: RawDetailedActivity = { ...summary(), elapsed_time: 700, description: 'first attempt' };
    const b: RawDetailedActivity = { ...summary(), elapsed_time: 700, description: 'REVISED writeup' };
    expect(summaryHash(a)).toBe(summaryHash(b));
  });
});

describe('summaryHashV1 (migration)', () => {
  it('differs from v2, and ignores gear like the old scheme did', () => {
    expect(summaryHashV1(summary())).not.toBe(summaryHash(summary()));
    expect(summaryHashV1(summary({ gear_id: 'g999' }))).toBe(summaryHashV1(summary()));
    expect(summaryHashV1(summary({ name: 'Renamed' }))).not.toBe(summaryHashV1(summary()));
  });
});

describe('sourceHash (detail + photos fingerprint)', () => {
  const detail = (over: Partial<RawDetailedActivity> = {}): RawDetailedActivity => ({
    ...summary(),
    elapsed_time: 700,
    description: 'first attempt',
    ...over,
  });
  const photo = (id: string, caption: string | null = null): RawPhoto => ({
    unique_id: id,
    urls: { '2048': `https://x/${id}.jpg` },
    caption,
  });
  const base = sourceHash(detail(), [photo('a'), photo('b')]);

  it('is deterministic and ignores photo URLs (which are signed and rotate)', () => {
    const rotated = [
      { ...photo('a'), urls: { '2048': 'https://y/a.jpg?sig=1' } },
      { ...photo('b'), urls: { '2048': 'https://y/b.jpg?sig=2' } },
    ];
    expect(sourceHash(detail(), rotated)).toBe(base);
  });

  it('catches the edits the summary crawl cannot see', () => {
    expect(sourceHash(detail({ description: 'REVISED' }), [photo('a'), photo('b')])).not.toBe(base);
    expect(sourceHash(detail(), [photo('a'), photo('c')])).not.toBe(base); // same-count swap
    expect(sourceHash(detail(), [photo('a', 'summit!'), photo('b')])).not.toBe(base); // caption
    expect(sourceHash(detail(), [photo('b'), photo('a')])).not.toBe(base); // reorder (cover = first)
    expect(sourceHash(detail({ gear_id: 'g999' }), [photo('a'), photo('b')])).not.toBe(base);
  });
});

describe('stalePhotoFiles (per-activity photo GC)', () => {
  it('flags only unreferenced photo-* files, never the route thumb or temp files', () => {
    const keep = keptPhotoFiles([{ file: 'photo-a.jpg' }, { file: 'photo-PXL_1.jpg' }]);
    const files = [
      'route.jpg',
      'photo-a.jpg',
      'photo-a-thumb.jpg',
      'photo-PXL_1.jpg',
      'photo-PXL_1-thumb.jpg',
      'photo-gone.jpg',
      'photo-gone-thumb.jpg',
      'photo-new.jpg.tmp',
    ];
    expect(stalePhotoFiles(files, keep)).toEqual(['photo-gone.jpg', 'photo-gone-thumb.jpg']);
  });
});
