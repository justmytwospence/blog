/**
 * @blog/strava — Strava API client + pure transforms for the Adventures feature.
 *
 * Runtime exports are used ONLY by the sync script (Node). The site imports types from
 * `@blog/strava/types` and reads the committed JSON snapshot via lib/adventures.ts.
 */

export * from './types';
export { mintAccessToken } from './auth';
export {
  RateLimitError,
  listActivities,
  getActivityDetail,
  getActivityStreams,
  getActivityPhotos,
  type ListActivitiesOptions,
} from './client';
export { decodePolyline, encodePolyline, downsampleTrack, type TrackPoint } from './polyline';
export { fetchHistoricalWeather } from './weather';
export { transformDetailToActivity, mapSportType, buildPhotosFromRaw } from './transform';
export { parseStravaIds, usesIdArray } from './companions';
export { reverseGeocode, type GeoLocation } from './geocode';
export {
  INDOOR_SPORT,
  isPoolSwim,
  isHumanPowered,
  RACE_WORKOUT_TYPES,
  isRaceWorkoutType,
  type ClassifiableActivity,
} from './classify';
export {
  buildTotals,
  type StravaTotals,
  type LifetimeTotals,
  type YearlyTotals,
  type YearPoint,
  type SportTotal,
  type YearSportTree,
} from './totals';
export { toEntry, crawlActivities, pageRawSummaries, type RetryPolicy } from './crawl';
