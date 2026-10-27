import { intensityScale, rampColor } from '@/components/ContributionCalendar';

describe('contribution heatmap intensity', () => {
  it('ranks active days, keeping empty days at 0 and the busiest at 1', () => {
    const scale = intensityScale([0, 0, 1, 2, 3, 4]);
    expect(scale(0)).toBe(0);
    expect(scale(4)).toBe(1);
    const ts = [1, 2, 3].map(scale);
    expect(ts[0]).toBeGreaterThan(0);
    expect(ts[0]).toBeLessThan(ts[1]);
    expect(ts[1]).toBeLessThan(ts[2]);
  });

  it('gives every distinct count its own shade, however skewed the year', () => {
    const counts = [1, 1, 2, 3, 5, 8, 13, 21, 34, 500];
    const scale = intensityScale(counts);
    const colors = new Set([...new Set(counts)].map((c) => rampColor(['#9be9a8', '#216e3a'], scale(c))));
    expect(colors.size).toBe(new Set(counts).size);
    // One outlier doesn't compress the rest toward the palest shade.
    expect(scale(34)).toBeGreaterThan(0.8);
  });

  it('interpolates through the ramp stops', () => {
    expect(rampColor(['#000000', '#ffffff'], 0)).toBe('rgb(0 0 0)');
    expect(rampColor(['#000000', '#ffffff'], 1)).toBe('rgb(255 255 255)');
    expect(rampColor(['#000000', '#646464', '#ffffff'], 0.5)).toBe('rgb(100 100 100)');
  });

  it('handles an empty year', () => {
    expect(intensityScale([0, 0])(0)).toBe(0);
  });
});
