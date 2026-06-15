/**
 * Pure unit formatters for Adventures. Data is stored in SI; the UI converts here.
 * Default is imperial (the athlete's Strava `measurement_preference` is `feet`); a metric
 * toggle is a one-arg change since every formatter threads `UnitSystem`.
 */

export type UnitSystem = 'imperial' | 'metric';

export const M_PER_MI = 1609.344;
export const FT_PER_M = 3.280839895;
const KMH_PER_MS = 3.6;
const MPH_PER_MS = 2.2369362921;

function commas(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function metersToMiles(m: number): number {
  return m / M_PER_MI;
}
export function metersToFeet(m: number): number {
  return m * FT_PER_M;
}

export function formatDistance(meters: number, unit: UnitSystem = 'imperial'): string {
  return unit === 'metric' ? `${commas(meters / 1000, 1)} km` : `${commas(meters / M_PER_MI, 1)} mi`;
}

export function formatElevation(meters: number, unit: UnitSystem = 'imperial'): string {
  return unit === 'metric' ? `${commas(meters)} m` : `${commas(meters * FT_PER_M)} ft`;
}

/** h:mm:ss, dropping the hours segment when zero. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function paceFromSpeed(metersPerSec: number, unit: UnitSystem): string {
  if (metersPerSec <= 0) return '—';
  const perUnit = unit === 'metric' ? 1000 : M_PER_MI;
  const secPerUnit = perUnit / metersPerSec;
  let m = Math.floor(secPerUnit / 60);
  let s = Math.round(secPerUnit % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')} /${unit === 'metric' ? 'km' : 'mi'}`;
}

function formatSpeed(metersPerSec: number, unit: UnitSystem): string {
  return unit === 'metric'
    ? `${(metersPerSec * KMH_PER_MS).toFixed(1)} km/h`
    : `${(metersPerSec * MPH_PER_MS).toFixed(1)} mph`;
}

/** Swimming is conventionally min/100m even in imperial mode. */
function swimPace(metersPerSec: number): string {
  if (metersPerSec <= 0) return '—';
  const secPer100 = 100 / metersPerSec;
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${String(s).padStart(2, '0')} /100m`;
}

const PACE_SPORTS = new Set(['Run', 'TrailRun', 'Hike', 'Walk', 'Snowshoe', 'Mountaineering']);
const SPEED_SPORTS = new Set([
  'Ride',
  'GravelRide',
  'MountainBikeRide',
  'EBikeRide',
  'VirtualRide',
  'NordicSki',
  'AlpineSki',
  'BackcountrySki',
  'Snowboard',
  'Kayaking',
  'Canoeing',
  'Rowing',
  'StandUpPaddling',
]);

/** Sport-aware: run/hike → pace per mi, ride/ski → speed, swim → /100m. */
export function formatPaceOrSpeed(
  metersPerSec: number,
  sport: string,
  unit: UnitSystem = 'imperial',
): { label: string; value: string } {
  if (sport === 'Swim') return { label: 'Pace', value: swimPace(metersPerSec) };
  if (PACE_SPORTS.has(sport)) return { label: 'Pace', value: paceFromSpeed(metersPerSec, unit) };
  if (SPEED_SPORTS.has(sport)) return { label: 'Speed', value: formatSpeed(metersPerSec, unit) };
  return { label: 'Speed', value: formatSpeed(metersPerSec, unit) };
}

export function formatTemp(celsius: number, unit: UnitSystem = 'imperial'): string {
  return unit === 'metric'
    ? `${Math.round(celsius)} °C`
    : `${Math.round((celsius * 9) / 5 + 32)} °F`;
}

export function formatWind(metersPerSec: number, unit: UnitSystem = 'imperial'): string {
  return unit === 'metric'
    ? `${Math.round(metersPerSec * KMH_PER_MS)} km/h`
    : `${Math.round(metersPerSec * MPH_PER_MS)} mph`;
}
