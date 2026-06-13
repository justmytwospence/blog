import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { ArticleMarkdown } from '@/components/ArticleMarkdown';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import { SportBadge } from './SportBadge';
import { AdventureStats } from './AdventureStats';
import { RouteMap } from './RouteMap';
import { ElevationProfile } from './ElevationProfile';
import { MetricCharts } from './MetricCharts';
import { PhotoGallery } from './PhotoGallery';
import { HoverReset } from './HoverReset';
import type { Adventure, AdventureDay } from '@/lib/adventures';

function placeOf(loc: { city: string | null; state: string | null; country: string | null }): string {
  return [loc.city, loc.state ?? loc.country].filter(Boolean).join(', ');
}

function ReportMeta({ adventure }: { adventure: Adventure }) {
  const chips: string[] = [];
  if (adventure.difficulty) chips.push(adventure.difficulty);
  if (adventure.grade) chips.push(adventure.grade);
  if (adventure.type) chips.push(adventure.type);
  if (chips.length === 0 && adventure.rating == null && adventure.tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {adventure.rating != null && (
        <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`Rated ${adventure.rating} out of 5`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < (adventure.rating ?? 0) ? 'fill-current' : 'opacity-30'}`} />
          ))}
        </span>
      )}
      {chips.map((c) => (
        <span
          key={`chip-${c}`}
          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs capitalize text-gray-700 dark:bg-[#3a3d41] dark:text-[#cccccc]"
        >
          {c}
        </span>
      ))}
      {adventure.tags.map((t) => (
        <span key={`tag-${t}`} className="rounded-full px-2 py-0.5 text-xs text-gray-500 dark:text-[#a6a6a6]">
          #{t}
        </span>
      ))}
    </div>
  );
}

function DayRow({ day, sportType }: { day: AdventureDay; sportType: Adventure['sportType'] }) {
  const a = day.activity;
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-[#303031]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900 dark:text-[#d4d4d4]">
          Day {day.dayIndex + 1}
          {day.title ? ` — ${day.title}` : ''}
        </span>
        <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">{formatDate(a.date, 'short')}</span>
      </div>
      {day.caption && <p className="mt-1 text-sm text-gray-600 dark:text-[#cccccc]">{day.caption}</p>}
      <div className="mt-3">
        <AdventureStats stats={a.stats} sportType={a.sportType || sportType} />
      </div>
    </div>
  );
}

function DayBreakdown({ adventure }: { adventure: Adventure }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Day by day</h2>
      <div className="space-y-3">
        {adventure.days.map((d) => (
          <DayRow key={d.dayIndex} day={d} sportType={adventure.sportType} />
        ))}
      </div>
    </section>
  );
}

function StravaLinks({ adventure }: { adventure: Adventure }) {
  return (
    <div className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-[#303031] dark:text-[#a6a6a6]">
      {adventure.days.length === 1 ? (
        <a
          href={adventure.primaryActivity.stravaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-700 dark:hover:text-[#d4d4d4]"
        >
          View on Strava ↗
        </a>
      ) : (
        <span>
          On Strava:{' '}
          {adventure.days.map((d, i) => (
            <span key={d.activity.stravaId}>
              {i > 0 && ', '}
              <a
                href={d.activity.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-[#d4d4d4]"
              >
                Day {d.dayIndex + 1}
              </a>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export function AdventureReport({ adventure }: { adventure: Adventure }) {
  const loc = placeOf(adventure.location);
  // Phase 4 renders the map/charts for single-activity reports; Phase 7 adds the multi-day combined map.
  const track = adventure.isMultiDay ? null : adventure.primaryActivity.track;
  const epic = `${formatDistance(adventure.totals.distanceMeters)} · ${formatElevation(
    adventure.totals.elevationGainMeters,
  )} · ${formatDuration(adventure.totals.movingTimeSeconds)}`;

  return (
    <div>
      <HoverReset />
      <Link
        href="/adventures"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
      >
        <ArrowLeft className="h-4 w-4" /> Adventures
      </Link>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-[#a6a6a6]">
          <SportBadge sportType={adventure.sportType} />
          <span>{formatDate(adventure.date)}</span>
          {adventure.isMultiDay && <span>· {adventure.days.length} days</span>}
          {loc && <span>· {loc}</span>}
        </div>
        <h1 className="mt-2 text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">{adventure.title}</h1>
        <p className="mt-1 text-lg tabular-nums text-gray-600 dark:text-[#cccccc]">{epic}</p>
        <ReportMeta adventure={adventure} />
      </header>

      {track && track.coordinates.length > 1 && (
        <div className="mb-8">
          <RouteMap track={track} photos={adventure.allPhotos} title={adventure.title} />
        </div>
      )}

      <AdventureStats stats={adventure.totals} sportType={adventure.sportType} />

      {track && track.altitude.length > 1 && <ElevationProfile track={track} />}
      {track && <MetricCharts track={track} />}

      {adventure.isMultiDay && <DayBreakdown adventure={adventure} />}

      {adventure.allPhotos.length > 0 && (
        <PhotoGallery photos={adventure.allPhotos} galleryId={`adv-${adventure.slug}`} />
      )}

      {adventure.content.trim() && (
        <article className="prose mt-8 max-w-none dark:prose-invert">
          <ArticleMarkdown content={adventure.content} />
        </article>
      )}

      <StravaLinks adventure={adventure} />
    </div>
  );
}
