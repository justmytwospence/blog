/**
 * Types for the Strava integration.
 *
 * Three tiers:
 *   1. Raw* — the subset of the Strava API response shapes we consume (internal).
 *   2. Normalized public types (Adventure*) — what the sync writes to JSON and the
 *      site imports. **All units are SI** (meters, m/s, seconds, °C); the UI converts.
 *   3. TokenResult — the OAuth refresh result.
 *
 * Coordinate convention: stored coordinates are [lng, lat] (GeoJSON order).
 */

// ─── Raw Strava shapes (internal) ──────────────────────────────────

export type StreamKey =
  | 'latlng'
  | 'altitude'
  | 'distance'
  | 'time'
  | 'grade_smooth'
  | 'heartrate'
  | 'velocity_smooth'
  | 'cadence'
  | 'watts'
  | 'temp';

export interface RawStream {
  data: number[] | Array<[number, number]>;
  series_type?: string;
  original_size?: number;
  resolution?: string;
}

export type RawStreamSet = Partial<Record<StreamKey, RawStream>>;

export interface RawPhoto {
  unique_id: string;
  urls: Record<string, string>;
  location?: [number, number] | null;
  caption?: string | null;
  default_photo?: boolean;
}

export interface RawActivityMap {
  id?: string;
  polyline?: string | null;
  summary_polyline?: string | null;
}

export interface RawSummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  total_photo_count?: number;
  private?: boolean;
  /** Strava workout type. Run: 1 = race. Ride: 11 = race. */
  workout_type?: number | null;
  /** True for indoor trainer / treadmill efforts (TrainerRoad, Zwift, etc.). */
  trainer?: boolean;
  /** True for commutes. */
  commute?: boolean;
  /** Pool swims set this; open-water swims don't. */
  pool_length?: number | null;
  map?: RawActivityMap;
}

export interface RawDetailedActivity extends RawSummaryActivity {
  elapsed_time: number;
  elev_high?: number | null;
  elev_low?: number | null;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  max_watts?: number;
  device_watts?: boolean;
  calories?: number;
  suffer_score?: number | null;
  start_date?: string;
  timezone?: string;
  start_latlng?: [number, number] | [];
  end_latlng?: [number, number] | [];
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  map?: RawActivityMap;
  gear?: { name?: string } | null;
  description?: string | null;
}

// ─── Normalized public types (SI units) ────────────────────────────

/** Strava sport_type values we recognize, plus override-only `Mountaineering` and `Other`. */
export type SportType =
  | 'TrailRun'
  | 'Run'
  | 'Hike'
  | 'Walk'
  | 'Ride'
  | 'GravelRide'
  | 'MountainBikeRide'
  | 'EBikeRide'
  | 'VirtualRide'
  | 'BackcountrySki'
  | 'NordicSki'
  | 'AlpineSki'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Swim'
  | 'StandUpPaddling'
  | 'Kayaking'
  | 'Canoeing'
  | 'Rowing'
  | 'RockClimbing'
  | 'Mountaineering'
  | 'Workout'
  | 'Other';

export interface GeoBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface AdventureTrack {
  /** [lng, lat] pairs (GeoJSON order), downsampled. Index-aligned with the channel arrays. */
  coordinates: Array<[number, number]>;
  altitude: number[]; // meters (empty if absent)
  distance: number[]; // cumulative meters (empty if absent)
  grade: number[]; // percent (empty if absent)
  velocity: number[]; // m/s (empty if absent)
  heartrate: number[]; // bpm (empty if absent)
  summaryPolyline: string | null; // encoded; for cheap thumbnails
  bounds: GeoBounds | null;
  pointCount: number;
}

export interface AdventureWeather {
  tempC: number | null;
  windMetersPerSec: number | null;
  precipitationMm: number | null;
  weatherCode: number | null; // WMO code
  observedAtLocal: string;
}

export interface AdventurePhoto {
  id: string; // Strava unique_id
  file: string; // local filename relative to the activity's public dir (set by sync)
  sourceUrl: string; // Strava CDN url (largest); only used during sync
  width: number; // set by sync after download
  height: number;
  caption: string | null;
  lat: number | null; // geotag (Strava-provided)
  lng: number | null;
}

export interface AdventureStats {
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  elevHighMeters: number | null;
  elevLowMeters: number | null;
  avgSpeedMetersPerSec: number;
  maxSpeedMetersPerSec: number;
  avgHeartrate: number | null;
  maxHeartrate: number | null;
  avgCadence: number | null;
  avgWatts: number | null;
  maxWatts: number | null;
  calories: number | null;
  sufferScore: number | null;
}

/** One Strava activity, fully normalized. The unit of sync + caching. */
export interface AdventureActivity {
  stravaId: number;
  name: string;
  sportType: SportType;
  startLocal: string; // ISO local datetime
  date: string; // YYYY-MM-DD (derived)
  timezone: string | null;
  location: { city: string | null; state: string | null; country: string | null };
  stats: AdventureStats;
  track: AdventureTrack | null; // null for indoor/manual/no-GPS
  weather: AdventureWeather | null;
  photos: AdventurePhoto[];
  gear: string | null;
  description: string | null; // raw Strava description (not the report prose)
  stravaUrl: string;
  syncedAt: string; // ISO
  sourceHash: string; // hash of mutating inputs → skip-unchanged
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string; // may differ from input → rotation
  expiresAt: number; // epoch seconds
  rotated: boolean;
}
