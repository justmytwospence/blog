'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { AdventureStats } from './AdventureStats';
import { SportBadge } from './SportBadge';
import { WeatherBadge } from './WeatherBadge';
import { dayColor } from './mapStyle';
import type { AdventureDay, SportType } from '@/lib/adventures';

function DayRow({ day, fallbackSport, unit }: { day: AdventureDay; fallbackSport: SportType; unit: 'day' | 'leg' }) {
  const [open, setOpen] = useState(false);
  const a = day.activity;
  const label = unit === 'leg' ? 'Leg' : 'Day';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-[#303031]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dayColor(day.dayIndex) }} aria-hidden="true" />
        {unit === 'leg' && <SportBadge sportType={a.sportType || fallbackSport} size="sm" />}
        <span className="font-semibold text-gray-900 dark:text-[#d4d4d4]">
          {label} {day.dayIndex + 1}
          {day.title ? ` — ${day.title}` : ''}
        </span>
        {unit === 'day' && <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">{formatDate(a.date, 'short')}</span>}
        <span className="ml-auto text-gray-400 dark:text-[#6b6b6b]" aria-hidden="true">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-[#2a2a2b]">
          {day.caption && <p className="mb-3 text-sm text-gray-600 dark:text-[#cccccc]">{day.caption}</p>}
          {a.weather && (
            <div className="mb-3 text-sm text-gray-500 dark:text-[#a6a6a6]">
              <WeatherBadge weather={a.weather} />
            </div>
          )}
          <AdventureStats stats={a.stats} sportType={a.sportType || fallbackSport} />
          {day.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {day.photos.map((p) => (
                <a
                  key={p.src}
                  href={p.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={p.caption ?? 'View photo'}
                  className="block overflow-hidden rounded"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.caption ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
          <a
            href={a.stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-gray-500 hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
          >
            View day on Strava ↗
          </a>
        </div>
      )}
    </div>
  );
}

export function TripDayBreakdown({
  days,
  fallbackSport,
  unit = 'day',
}: {
  days: AdventureDay[];
  fallbackSport: SportType;
  unit?: 'day' | 'leg';
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">
        {unit === 'leg' ? 'Leg by leg' : 'Day by day'}
      </h2>
      <div className="space-y-2">
        {days.map((d) => (
          <DayRow key={d.dayIndex} day={d} fallbackSport={fallbackSport} unit={unit} />
        ))}
      </div>
    </section>
  );
}
