/**
 * Historical weather enrichment via the Open-Meteo archive API (free, no key).
 * Returns SI units (°C, m/s, mm). Graceful: returns null on any failure.
 */

import type { AdventureWeather } from './types';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

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

    const targetMs = opts.startLocalIso
      ? new Date(opts.startLocalIso).getTime()
      : new Date(`${opts.date}T12:00`).getTime();
    let bestIdx = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < h.time.length; i++) {
      const diff = Math.abs(new Date(h.time[i]).getTime() - targetMs);
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
