/**
 * Historical weather enrichment via the Open-Meteo archive API (free, no key).
 * Returns SI units (°C, m/s, mm). Graceful: returns null on any failure.
 */

import type { AdventureWeather } from './types';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Minutes-since-midnight from an ISO-ish timestamp, IGNORING any timezone offset.
 * Both Strava `start_date_local` (suffixed with a misleading 'Z') and Open-Meteo's
 * `timezone:auto` hourly times represent the activity's local wall clock, so we match
 * on the naive local time rather than absolute epoch ms (which would mis-parse the 'Z').
 */
function minutesOfDay(iso: string): number {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 12 * 60;
}

export async function fetchHistoricalWeather(opts: {
  lat: number;
  lng: number;
  date: string; // YYYY-MM-DD (local)
  startLocalIso?: string; // to pick the nearest hour
}): Promise<AdventureWeather | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(opts.lat),
      longitude: String(opts.lng),
      start_date: opts.date,
      end_date: opts.date,
      hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
      temperature_unit: 'celsius',
      wind_speed_unit: 'ms',
      precipitation_unit: 'mm',
      timezone: 'auto',
    });
    const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
    if (!res.ok) {
      console.error(`[strava] weather API returned ${res.status} ${res.statusText}`);
      return null;
    }
    const json = (await res.json()) as {
      hourly?: {
        time: string[];
        temperature_2m: Array<number | null>;
        precipitation: Array<number | null>;
        weather_code: Array<number | null>;
        wind_speed_10m: Array<number | null>;
      };
    };
    const h = json.hourly;
    if (!h || !Array.isArray(h.time) || h.time.length === 0) return null;

    const targetMin = opts.startLocalIso ? minutesOfDay(opts.startLocalIso) : 12 * 60;
    let bestIdx = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < h.time.length; i++) {
      const diff = Math.abs(minutesOfDay(h.time[i]) - targetMin);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    return {
      tempC: h.temperature_2m?.[bestIdx] ?? null,
      windMetersPerSec: h.wind_speed_10m?.[bestIdx] ?? null,
      precipitationMm: h.precipitation?.[bestIdx] ?? null,
      weatherCode: h.weather_code?.[bestIdx] ?? null,
      observedAtLocal: h.time?.[bestIdx] ?? opts.date,
    };
  } catch (err) {
    console.error('[strava] weather fetch failed:', err);
    return null;
  }
}
