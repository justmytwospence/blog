import { CloudSun } from 'lucide-react';
import { formatTemp, formatWind } from '@/lib/units';
import type { AdventureWeather } from '@/lib/adventures';

function wmoLabel(code: number | null): string | null {
  if (code == null) return null;
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

export function WeatherBadge({ weather }: { weather: AdventureWeather }) {
  const parts: string[] = [];
  if (weather.tempC != null) parts.push(formatTemp(weather.tempC));
  const cond = wmoLabel(weather.weatherCode);
  if (cond) parts.push(cond);
  if (weather.windMetersPerSec != null) parts.push(`${formatWind(weather.windMetersPerSec)} wind`);
  if (parts.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-[#3a3d41] dark:text-[#cccccc]">
      <CloudSun className="h-3.5 w-3.5" aria-hidden="true" />
      {parts.join(' · ')}
    </span>
  );
}
