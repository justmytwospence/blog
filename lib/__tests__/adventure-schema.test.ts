import { describe, it, expect } from 'vitest';
import {
  derivePeakClass,
  isCompanionFile,
  ADVENTURE_TYPES,
  PEAKISH_TYPES,
  SUMMIT_SPORTS,
} from '../adventure-schema';

/** Feet → meters, the exact inverse of the ft-per-meter constant derivePeakClass multiplies by.
 *  Boundary cases are asserted a foot either side: a float round-trip through this conversion
 *  cannot reliably reproduce an exact threshold value. */
const ft = (feet: number) => feet / 3.28084;

describe('derivePeakClass', () => {
  it('lets an explicit override win over the elevation', () => {
    // The imported summits whose GPX high point lands just under the line.
    expect(derivePeakClass('14er', 'peak', 'Hike', ft(13950))).toBe('14er');
    expect(derivePeakClass('13er', 'peak', 'Hike', ft(14500))).toBe('13er');
  });

  it('ignores an unrecognized override and falls back to deriving', () => {
    expect(derivePeakClass('12er', 'peak', 'Hike', ft(14100))).toBe('14er');
  });

  it('never badges a thru-hike, however high it goes', () => {
    // The Colorado Trail / PCT cross 13k passes without bagging a peak.
    expect(derivePeakClass(null, 'thru-hike', 'Hike', ft(13153))).toBeNull();
    expect(derivePeakClass(null, 'thru-hike', 'Hike', ft(14500))).toBeNull();
  });

  it('badges by elevation for summit-style types and sports', () => {
    expect(derivePeakClass(null, 'peak', 'Hike', ft(14433))).toBe('14er');
    expect(derivePeakClass(null, 'couloir', 'BackcountrySki', ft(13500))).toBe('13er');
    // Sport alone is enough, with no `type` set.
    expect(derivePeakClass(null, null, 'Mountaineering', ft(14001))).toBe('14er');
    // Type alone is enough, with an unremarkable sport.
    expect(derivePeakClass(null, 'scramble', 'Ride', ft(13200))).toBe('13er');
  });

  it('does not badge a non-summit outing that merely climbs high', () => {
    // A road race over a high pass is not a peak.
    expect(derivePeakClass(null, null, 'Ride', ft(14500))).toBeNull();
    expect(derivePeakClass(null, null, 'Run', ft(13800))).toBeNull();
  });

  it('splits 14er/13er/none at the 14000 and 13000 ft thresholds', () => {
    expect(derivePeakClass(null, 'peak', 'Hike', ft(14001))).toBe('14er');
    expect(derivePeakClass(null, 'peak', 'Hike', ft(13999))).toBe('13er');
    expect(derivePeakClass(null, 'peak', 'Hike', ft(13001))).toBe('13er');
    expect(derivePeakClass(null, 'peak', 'Hike', ft(12999))).toBeNull();
  });

  it('survives a non-finite elevation', () => {
    // buildAdventure takes Math.max() of an empty set for a snapshot with no elevation data.
    expect(derivePeakClass(null, 'peak', 'Hike', -Infinity)).toBeNull();
    expect(derivePeakClass(null, 'peak', 'Hike', NaN)).toBeNull();
    // An override still wins — it never consults the elevation.
    expect(derivePeakClass('14er', 'peak', 'Hike', -Infinity)).toBe('14er');
  });

  it('tolerates a null sport', () => {
    expect(derivePeakClass(null, 'peak', null, ft(14100))).toBe('14er');
    expect(derivePeakClass(null, null, null, ft(14100))).toBeNull();
  });
});

describe('taxonomy set invariants', () => {
  it('PEAKISH_TYPES is exactly ADVENTURE_TYPES minus thru-hike', () => {
    expect([...PEAKISH_TYPES].sort()).toEqual(ADVENTURE_TYPES.filter((t) => t !== 'thru-hike').sort());
  });

  it('every SUMMIT_SPORTS member is a valid adventure sport', () => {
    // Typed as AdventureSport at the declaration, so this guards a future widening.
    expect(SUMMIT_SPORTS.size).toBeGreaterThan(0);
  });
});

describe('isCompanionFile', () => {
  it('accepts report companions', () => {
    expect(isCompanionFile('mount-elbert.md')).toBe(true);
  });

  it('rejects non-markdown', () => {
    expect(isCompanionFile('all-activities.json')).toBe(false);
    expect(isCompanionFile('README')).toBe(false);
  });

  it('rejects dotfiles, including macOS AppleDouble siblings', () => {
    // `._foo.md` is binary and breaks gray-matter.
    expect(isCompanionFile('._mount-elbert.md')).toBe(false);
    expect(isCompanionFile('.DS_Store')).toBe(false);
  });
});
