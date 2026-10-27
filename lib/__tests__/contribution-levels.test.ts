import { level, levelThresholds } from '@/components/ContributionCalendar';

describe('contribution heatmap levels', () => {
  it('derives thresholds from the quartiles of active days, ignoring empty ones', () => {
    expect(levelThresholds([0, 0, 1, 2, 3, 4])).toEqual([1, 2, 3]);
  });

  it('spreads a busy year across all four levels instead of saturating', () => {
    const counts = Array.from({ length: 100 }, (_, i) => 20 + i);
    const t = levelThresholds(counts);
    const levels = counts.map((c) => level(c, t));
    for (const l of [1, 2, 3, 4]) {
      expect(levels.filter((x) => x === l)).toHaveLength(25);
    }
  });

  it('keeps empty days at level 0 and handles an empty year', () => {
    const t = levelThresholds([0, 0]);
    expect(t).toEqual([0, 0, 0]);
    expect(level(0, t)).toBe(0);
    expect(level(5, levelThresholds([5]))).toBe(1);
  });
});
