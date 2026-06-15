import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  formatElevation,
  formatDuration,
  formatPaceOrSpeed,
  formatTemp,
  formatWind,
} from '../units';

describe('units', () => {
  it('formats distance (imperial default + metric)', () => {
    expect(formatDistance(1609.344)).toBe('1.0 mi');
    expect(formatDistance(1609.344, 'metric')).toBe('1.6 km');
  });

  it('formats elevation with thousands separators', () => {
    expect(formatElevation(1000)).toBe('3,281 ft');
    expect(formatElevation(1000, 'metric')).toBe('1,000 m');
  });

  it('formats duration h:mm:ss, dropping zero hours', () => {
    expect(formatDuration(3742)).toBe('1:02:22');
    expect(formatDuration(2530)).toBe('42:10');
  });

  it('is sport-aware for pace vs speed', () => {
    expect(formatPaceOrSpeed(3.0, 'Run')).toEqual({ label: 'Pace', value: '8:56 /mi' });
    expect(formatPaceOrSpeed(8.94, 'Ride').label).toBe('Speed');
    expect(formatPaceOrSpeed(1.5, 'Swim').value).toMatch(/\/100m$/);
  });

  it('formats temperature and wind', () => {
    expect(formatTemp(0)).toBe('32 °F');
    expect(formatTemp(0, 'metric')).toBe('0 °C');
    expect(formatWind(10)).toMatch(/mph$/);
  });
});
