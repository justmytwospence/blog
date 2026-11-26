import { describe, expect, it } from 'vitest';
import { minStickyShift, nextStickyShift } from '../sticky-sidebar';

describe('sticky sidebar shift', () => {
  it('never shifts a sidebar that fits', () => {
    expect(minStickyShift(900, 97, 600, 32)).toBe(0);
  });

  it('allows a tall sidebar to rise until its bottom edge shows', () => {
    // 900 viewport, 97 offset, 1500 tall, 32 gap: rise by 729 so the bottom sits 32px up.
    expect(minStickyShift(900, 97, 1500, 32)).toBe(-729);
  });

  it('rises while scrolling down and settles at its bottom edge', () => {
    expect(nextStickyShift(0, 300, -729)).toBe(-300);
    expect(nextStickyShift(-600, 300, -729)).toBe(-729);
  });

  it('falls back while scrolling up and settles at its top edge', () => {
    expect(nextStickyShift(-729, -200, -729)).toBe(-529);
    expect(nextStickyShift(-100, -200, -729)).toBe(0);
  });
});
