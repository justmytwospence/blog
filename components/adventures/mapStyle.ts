/**
 * Pure map/route styling helpers (no Leaflet import, so it's safe to import anywhere).
 * Tile config, metric color ramps, and the multi-day palette.
 */

export const OPENTOPO_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
export const OPENTOPO_ATTRIBUTION =
  'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';
export const OPENTOPO_MAX_ZOOM = 17;

/** The metric a route can be colored by. */
export type RouteColorMetric = 'grade' | 'speed' | 'hr';

/** Diverging color for grade (%, uphill positive): green flat → red steep up, green → cyan steep down. */
export function gradeColor(gradePct: number, alpha = 1): string {
  const a = alpha < 1 ? ` / ${alpha}` : '';
  if (gradePct >= 0) {
    const t = Math.min(gradePct, 25) / 25;
    return `hsl(${Math.round(120 - 120 * t)} 75% 45%${a})`; // green → red
  }
  const t = Math.min(-gradePct, 25) / 25;
  return `hsl(${Math.round(120 + 90 * t)} 70% 45%${a})`; // green → cyan
}

/** Sequential ramp blue (low) → red (high) for an arbitrary metric normalized to [min,max]. */
export function rampColor(value: number, min: number, max: number): string {
  const t = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  return `hsl(${Math.round(210 - 210 * t)} 75% 48%)`;
}

/** Colorblind-aware day palette for multi-day trips (cycles for long thru-hikes). */
export const DAY_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

export function dayColor(i: number): string {
  return DAY_COLORS[i % DAY_COLORS.length];
}

/** A hex color per sport family, for tinting routes on the library overview map. */
const SPORT_HEX: Record<string, string> = {
  TrailRun: '#059669',
  Run: '#059669',
  Walk: '#6b7280',
  Hike: '#ea580c',
  Mountaineering: '#ea580c',
  RockClimbing: '#ea580c',
  Ride: '#d97706',
  GravelRide: '#d97706',
  MountainBikeRide: '#d97706',
  EBikeRide: '#d97706',
  VirtualRide: '#d97706',
  NordicSki: '#0284c7',
  BackcountrySki: '#0284c7',
  AlpineSki: '#0284c7',
  Snowboard: '#0284c7',
  Snowshoe: '#0284c7',
  Swim: '#0891b2',
  StandUpPaddling: '#0891b2',
  Kayaking: '#0891b2',
  Canoeing: '#0891b2',
  Rowing: '#0891b2',
};

export function sportColor(sport: string): string {
  return SPORT_HEX[sport] ?? '#6b7280';
}
