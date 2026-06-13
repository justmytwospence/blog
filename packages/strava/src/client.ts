/**
 * Strava API v3 fetch wrappers. Stateless — the caller passes the access token.
 *
 * Failure contract: non-2xx (other than 429) logs `[strava] …` and returns null/[] so a single
 * bad activity never crashes a whole sync. HTTP 429 throws RateLimitError so the caller can back off.
 */

import type {
  RawSummaryActivity,
  RawDetailedActivity,
  RawStreamSet,
  RawPhoto,
  StreamKey,
} from './types';

const API = 'https://www.strava.com/api/v3';

export class RateLimitError extends Error {
  constructor(public retryAfterMs?: number) {
    super('[strava] rate limited (HTTP 429)');
    this.name = 'RateLimitError';
  }
}

async function get<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    throw new RateLimitError();
  }
  if (!res.ok) {
    console.error(`[strava] ${res.status} ${res.statusText} for ${url}`);
    return null;
  }
  return (await res.json()) as T;
}

export interface ListActivitiesOptions {
  before?: number; // epoch seconds
  after?: number; // epoch seconds
  page?: number;
  perPage?: number;
}

export async function listActivities(
  token: string,
  opts: ListActivitiesOptions = {},
): Promise<RawSummaryActivity[]> {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', String(opts.before));
  if (opts.after) params.set('after', String(opts.after));
  params.set('page', String(opts.page ?? 1));
  params.set('per_page', String(opts.perPage ?? 30));
  const data = await get<RawSummaryActivity[]>(`${API}/athlete/activities?${params.toString()}`, token);
  return data ?? [];
}

export async function getActivityDetail(
  token: string,
  id: number,
): Promise<RawDetailedActivity | null> {
  return get<RawDetailedActivity>(`${API}/activities/${id}`, token);
}

const DEFAULT_STREAM_KEYS: StreamKey[] = [
  'latlng',
  'altitude',
  'distance',
  'grade_smooth',
  'heartrate',
  'velocity_smooth',
];

export async function getActivityStreams(
  token: string,
  id: number,
  keys: StreamKey[] = DEFAULT_STREAM_KEYS,
): Promise<RawStreamSet | null> {
  const k = keys.join(',');
  return get<RawStreamSet>(`${API}/activities/${id}/streams?keys=${k}&key_by_type=true`, token);
}

export async function getActivityPhotos(
  token: string,
  id: number,
  size = 5000,
): Promise<RawPhoto[]> {
  const data = await get<RawPhoto[]>(
    `${API}/activities/${id}/photos?size=${size}&photo_sources=true`,
    token,
  );
  return data ?? [];
}
