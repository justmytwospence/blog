/**
 * Activity classification for lifetime stats. Promoted out of the retired triage sweep so the live
 * sync owns the one rule that matters going forward: which activities are "human-powered" and count
 * toward all-time totals. The predicates are verbatim from the sweep's deterministic excludes.
 */
import type { RawSummaryActivity } from './types';

/** Strava sport_type values that are indoor / virtual / pure-training — never human-powered outdoors. */
export const INDOOR_SPORT = new Set<string>([
  'VirtualRide',
  'EBikeRide',
  'Velomobile',
  'VirtualRun',
  'VirtualRow',
  'Workout',
  'WeightTraining',
  'Yoga',
  'Elliptical',
  'StairStepper',
  'Crossfit',
  'Pilates',
]);

/** Pool (indoor lap) swim — distinct from open-water; has a pool_length or no GPS track. */
export function isPoolSwim(a: RawSummaryActivity): boolean {
  const sport = a.sport_type ?? a.type ?? 'Workout';
  return sport === 'Swim' && (Boolean(a.pool_length && a.pool_length > 0) || !a.map?.summary_polyline);
}

/**
 * Strava `workout_type` values that mean "race": 1 on a Run, 11 on a Ride. No other sport encodes a
 * race, so a race in any other sport can only be declared by frontmatter.
 */
export const RACE_WORKOUT_TYPES: ReadonlySet<number> = new Set([1, 11]);

/**
 * Whether a snapshot's `workoutType` marks it a race. Null/undefined — manual imports and
 * pre-schema snapshots that predate the field — are not races; a caller that needs to tell
 * "absent" apart from "not a race" must check for that before calling this.
 */
export function isRaceWorkoutType(workoutType: number | null | undefined): boolean {
  return typeof workoutType === 'number' && RACE_WORKOUT_TYPES.has(workoutType);
}

/** The minimal shape needed to classify an activity (satisfied by a raw summary or an index entry). */
export interface ClassifiableActivity {
  sport: string; // raw Strava sport_type
  trainer?: boolean;
  commute?: boolean;
  poolSwim?: boolean;
}

/**
 * Whether an activity counts toward lifetime human-powered totals: excludes indoor/virtual/gym sports,
 * trainer efforts, and pool swims. Commutes ARE counted — a commute ride is still human-powered.
 */
export function isHumanPowered(a: ClassifiableActivity): boolean {
  if (a.trainer || a.poolSwim) return false;
  if (INDOOR_SPORT.has(a.sport)) return false;
  return true;
}
