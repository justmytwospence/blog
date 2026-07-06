/**
 * Pure transforms: raw Strava shapes → normalized SI `AdventureActivity`.
 * No I/O. The sync script supplies `sourceHash` and downloads photos afterward.
 */

import type {
  RawDetailedActivity,
  RawStreamSet,
  RawPhoto,
  AdventureActivity,
  AdventureTrack,
  AdventureWeather,
  AdventurePhoto,
  SportType,
} from './types';
import { decodePolyline, downsampleTrack, type TrackPoint } from './polyline';

const SPORT_MAP: Record<string, SportType> = {
  Run: 'Run',
  TrailRun: 'TrailRun',
  Hike: 'Hike',
  Walk: 'Walk',
  Ride: 'Ride',
  GravelRide: 'GravelRide',
  MountainBikeRide: 'MountainBikeRide',
  EBikeRide: 'EBikeRide',
  VirtualRide: 'VirtualRide',
  BackcountrySki: 'BackcountrySki',
  NordicSki: 'NordicSki',
  AlpineSki: 'AlpineSki',
  Snowboard: 'Snowboard',
  Snowshoe: 'Snowshoe',
  Swim: 'Swim',
  StandUpPaddling: 'StandUpPaddling',
  Kayaking: 'Kayaking',
  Canoeing: 'Canoeing',
  Rowing: 'Rowing',
  RockClimbing: 'RockClimbing',
  Workout: 'Workout',
};

export function mapSportType(raw?: string): SportType {
  if (!raw) return 'Other';
  return SPORT_MAP[raw] ?? 'Other';
}

/** Build AdventurePhoto[] from the raw photos endpoint (sync downloads + sizes them afterward). */
export function buildPhotosFromRaw(raw: RawPhoto[]): AdventurePhoto[] {
  return raw
    .filter((p) => p.urls && Object.keys(p.urls).length > 0)
    .map((p) => {
      const sizes = Object.keys(p.urls)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n));
      const largest = sizes.length ? Math.max(...sizes) : null;
      const url = largest !== null ? p.urls[String(largest)] : Object.values(p.urls)[0];
      const loc = Array.isArray(p.location) && p.location.length === 2 ? p.location : null;
      return {
        id: p.unique_id,
        file: '',
        sourceUrl: url,
        width: 0,
        height: 0,
        caption: p.caption ?? null,
        lat: loc ? loc[0] : null,
        lng: loc ? loc[1] : null,
      };
    });
}

function makeTrack(
  points: TrackPoint[],
  summaryPolyline: string | null,
  present: { alt: boolean; grade: boolean; vel: boolean; hr: boolean },
): AdventureTrack | null {
  if (points.length < 2) {
    return summaryPolyline
      ? { coordinates: [], altitude: [], distance: [], grade: [], velocity: [], heartrate: [], summaryPolyline, bounds: null, pointCount: 0 }
      : null;
  }
  const coordinates: Array<[number, number]> = [];
  const altitude: number[] = [];
  const distance: number[] = [];
  const grade: number[] = [];
  const velocity: number[] = [];
  const heartrate: number[] = [];
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const pt of points) {
    coordinates.push([pt.lng, pt.lat]);
    if (present.alt) altitude.push(pt.alt);
    if (present.grade) grade.push(pt.grade);
    if (present.vel) velocity.push(pt.vel);
    if (present.hr) heartrate.push(pt.hr);
    distance.push(pt.dist);
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }
  return {
    coordinates,
    altitude,
    distance: present.alt || distance.some((d) => d > 0) ? distance : [],
    grade,
    velocity,
    heartrate,
    summaryPolyline,
    bounds: { minLat, minLng, maxLat, maxLng },
    pointCount: coordinates.length,
  };
}

function buildTrack(detail: RawDetailedActivity, streams: RawStreamSet | null): AdventureTrack | null {
  const summaryPolyline = detail.map?.summary_polyline ?? detail.map?.polyline ?? null;
  const latlng = streams?.latlng?.data as Array<[number, number]> | undefined;

  if (latlng && latlng.length >= 2) {
    const altArr = (streams?.altitude?.data as number[] | undefined) ?? [];
    const distArr = (streams?.distance?.data as number[] | undefined) ?? [];
    const gradeArr = (streams?.grade_smooth?.data as number[] | undefined) ?? [];
    const velArr = (streams?.velocity_smooth?.data as number[] | undefined) ?? [];
    const hrArr = (streams?.heartrate?.data as number[] | undefined) ?? [];
    const points: TrackPoint[] = latlng.map(([lat, lng], i) => ({
      lat,
      lng,
      alt: altArr[i] ?? 0,
      dist: distArr[i] ?? 0,
      grade: gradeArr[i] ?? 0,
      vel: velArr[i] ?? 0,
      hr: hrArr[i] ?? 0,
    }));
    const ds = downsampleTrack(points);
    return makeTrack(ds, summaryPolyline, {
      alt: altArr.length > 0,
      grade: gradeArr.length > 0,
      vel: velArr.length > 0,
      hr: hrArr.length > 0,
    });
  }

  if (summaryPolyline) {
    const coords = decodePolyline(summaryPolyline);
    if (coords.length < 2) return null;
    const points: TrackPoint[] = coords.map(([lat, lng]) => ({
      lat,
      lng,
      alt: 0,
      dist: 0,
      grade: 0,
      vel: 0,
      hr: 0,
    }));
    const ds = downsampleTrack(points);
    return makeTrack(ds, summaryPolyline, { alt: false, grade: false, vel: false, hr: false });
  }

  return null;
}

export function transformDetailToActivity(
  detail: RawDetailedActivity,
  streams: RawStreamSet | null,
  weather: AdventureWeather | null,
  photos: AdventurePhoto[],
  meta: { sourceHash: string; summaryHash?: string },
): AdventureActivity {
  const startLocal = detail.start_date_local ?? '';
  return {
    stravaId: detail.id,
    name: detail.name ?? '',
    sportType: mapSportType(detail.sport_type ?? detail.type),
    startLocal,
    date: startLocal.slice(0, 10),
    timezone: detail.timezone ?? null,
    location: {
      city: detail.location_city ?? null,
      state: detail.location_state ?? null,
      country: detail.location_country ?? null,
    },
    stats: {
      distanceMeters: detail.distance ?? 0,
      movingTimeSeconds: detail.moving_time ?? 0,
      elapsedTimeSeconds: detail.elapsed_time ?? 0,
      elevationGainMeters: detail.total_elevation_gain ?? 0,
      elevHighMeters: detail.elev_high ?? null,
      elevLowMeters: detail.elev_low ?? null,
      avgSpeedMetersPerSec: detail.average_speed ?? 0,
      maxSpeedMetersPerSec: detail.max_speed ?? 0,
      avgHeartrate: detail.average_heartrate ?? null,
      maxHeartrate: detail.max_heartrate ?? null,
      avgCadence: detail.average_cadence ?? null,
      avgWatts: detail.average_watts ?? null,
      maxWatts: detail.max_watts ?? null,
      calories: detail.calories ?? null,
      sufferScore: detail.suffer_score ?? null,
    },
    track: buildTrack(detail, streams),
    weather,
    photos,
    gear: detail.gear?.name ?? null,
    description: detail.description ?? null,
    stravaUrl: `https://www.strava.com/activities/${detail.id}`,
    sourceHash: meta.sourceHash,
    // Appended after sourceHash so a freshly-synced snapshot matches the key order the migration
    // backfill produces (it appends these two to existing snapshots) — keeps future diffs minimal.
    workoutType: detail.workout_type ?? null,
    summaryHash: meta.summaryHash,
  };
}
