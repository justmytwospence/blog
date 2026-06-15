/**
 * Shared sport-type presentation: display label, icon, and pill colour classes.
 * Co-located with the UI because it carries Tailwind/icon choices.
 */
import {
  type LucideIcon,
  Footprints,
  Mountain,
  MountainSnow,
  Bike,
  Snowflake,
  Waves,
  Sailboat,
  Activity,
} from 'lucide-react';
import type { IconType } from 'react-icons';
import { MdDirectionsRun } from 'react-icons/md';
import { GiRunningShoe } from 'react-icons/gi';
import type { SportType } from '@/lib/adventures';

export interface SportMeta {
  label: string;
  Icon: LucideIcon | IconType;
  pill: string;
}

const GRAY = 'bg-gray-100 text-gray-700 dark:bg-[#3a3d41] dark:text-[#cccccc]';
const RUN = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
const RIDE = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
const SKI = 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
const ALPINE = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
const WATER = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';

const META: Record<string, SportMeta> = {
  Scramble: { label: 'Scramble', Icon: Mountain, pill: ALPINE },
  TrailRun: { label: 'Trail Run', Icon: GiRunningShoe, pill: RUN },
  Run: { label: 'Run', Icon: MdDirectionsRun, pill: RUN },
  Walk: { label: 'Walk', Icon: Footprints, pill: GRAY },
  Hike: { label: 'Hike', Icon: Mountain, pill: ALPINE },
  Mountaineering: { label: 'Mountaineering', Icon: MountainSnow, pill: ALPINE },
  RockClimbing: { label: 'Climbing', Icon: Mountain, pill: ALPINE },
  Snowshoe: { label: 'Snowshoe', Icon: Snowflake, pill: SKI },
  Ride: { label: 'Ride', Icon: Bike, pill: RIDE },
  GravelRide: { label: 'Gravel', Icon: Bike, pill: RIDE },
  MountainBikeRide: { label: 'MTB', Icon: Bike, pill: RIDE },
  EBikeRide: { label: 'E-Bike', Icon: Bike, pill: RIDE },
  VirtualRide: { label: 'Virtual Ride', Icon: Bike, pill: RIDE },
  NordicSki: { label: 'Nordic Ski', Icon: Snowflake, pill: SKI },
  BackcountrySki: { label: 'Skimo', Icon: Snowflake, pill: SKI },
  AlpineSki: { label: 'Alpine Ski', Icon: Snowflake, pill: SKI },
  Snowboard: { label: 'Snowboard', Icon: Snowflake, pill: SKI },
  Swim: { label: 'Swim', Icon: Waves, pill: WATER },
  StandUpPaddling: { label: 'SUP', Icon: Sailboat, pill: WATER },
  Kayaking: { label: 'Kayak', Icon: Sailboat, pill: WATER },
  Canoeing: { label: 'Canoe', Icon: Sailboat, pill: WATER },
  Rowing: { label: 'Row', Icon: Sailboat, pill: WATER },
  Workout: { label: 'Workout', Icon: Activity, pill: GRAY },
  Other: { label: 'Other', Icon: Activity, pill: GRAY },
};

export function sportMeta(sport: SportType | string): SportMeta {
  return META[sport as SportType] ?? { label: String(sport), Icon: Activity, pill: GRAY };
}
