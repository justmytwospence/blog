import { describe, it, expect } from 'vitest';
import { isHumanPowered, isPoolSwim, isRaceWorkoutType, RACE_WORKOUT_TYPES } from '../src/classify';
import type { RawSummaryActivity } from '../src/types';

const raw = (over: Partial<RawSummaryActivity>): RawSummaryActivity => ({
  id: 1,
  name: 'x',
  start_date_local: '2020-01-01T08:00:00Z',
  distance: 1000,
  moving_time: 600,
  total_elevation_gain: 100,
  sport_type: 'TrailRun',
  ...over,
});

describe('isHumanPowered', () => {
  it('includes outdoor foot/bike/ski', () => {
    expect(isHumanPowered({ sport: 'TrailRun' })).toBe(true);
    expect(isHumanPowered({ sport: 'Ride' })).toBe(true);
    expect(isHumanPowered({ sport: 'BackcountrySki' })).toBe(true);
  });
  it('excludes indoor/virtual/gym sports', () => {
    for (const s of ['VirtualRide', 'EBikeRide', 'Workout', 'WeightTraining', 'Yoga']) {
      expect(isHumanPowered({ sport: s })).toBe(false);
    }
  });
  it('excludes trainer efforts but counts commutes (commutes are human-powered)', () => {
    expect(isHumanPowered({ sport: 'Ride', trainer: true })).toBe(false);
    expect(isHumanPowered({ sport: 'Ride', commute: true })).toBe(true);
  });
  it('excludes pool swims but keeps open water', () => {
    expect(isHumanPowered({ sport: 'Swim', poolSwim: true })).toBe(false);
    expect(isHumanPowered({ sport: 'Swim', poolSwim: false })).toBe(true);
  });
});

describe('isPoolSwim', () => {
  it('flags swims with a pool length or no GPS', () => {
    expect(isPoolSwim(raw({ sport_type: 'Swim', pool_length: 25 }))).toBe(true);
    expect(isPoolSwim(raw({ sport_type: 'Swim', map: undefined }))).toBe(true);
  });
  it('does not flag open-water swims with a GPS track', () => {
    expect(isPoolSwim(raw({ sport_type: 'Swim', pool_length: null, map: { summary_polyline: 'abc' } }))).toBe(false);
  });
  it('does not flag non-swims', () => {
    expect(isPoolSwim(raw({ sport_type: 'TrailRun' }))).toBe(false);
  });
});

describe('isRaceWorkoutType', () => {
  it('treats Run 1 and Ride 11 as races', () => {
    expect(isRaceWorkoutType(1)).toBe(true);
    expect(isRaceWorkoutType(11)).toBe(true);
    expect([...RACE_WORKOUT_TYPES].sort((a, b) => a - b)).toEqual([1, 11]);
  });

  it('rejects the other workout_type codes', () => {
    // 0 = default, 2 = long run, 3 = workout, 10 = default ride, 12 = ride workout
    for (const wt of [0, 2, 3, 10, 12]) expect(isRaceWorkoutType(wt)).toBe(false);
  });

  it('treats an absent workoutType as not-a-race', () => {
    // Manual imports and pre-backfill snapshots have no workoutType at all.
    expect(isRaceWorkoutType(null)).toBe(false);
    expect(isRaceWorkoutType(undefined)).toBe(false);
  });
});
