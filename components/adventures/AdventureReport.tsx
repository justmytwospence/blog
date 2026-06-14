import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { ArticleMarkdown } from '@/components/ArticleMarkdown';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import { SportBadge } from './SportBadge';
import { PeakBadge } from './PeakBadge';
import { AdventureStats } from './AdventureStats';
import { RouteMap } from './RouteMap';
import { ElevationProfile } from './ElevationProfile';
import { MetricCharts } from './MetricCharts';
import { TerrainAnalysis } from './TerrainAnalysis';
import { PhotoGallery } from './PhotoGallery';
import { HoverReset } from './HoverReset';
import { WeatherBadge } from './WeatherBadge';
import { TripMap } from './TripMap';
import { TripElevation } from './TripElevation';
import { TripDayBreakdown } from './TripDayBreakdown';
import type { Adventure } from '@/lib/adventures';

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

function StravaLinks({ adventure }: { adventure: Adventure }) {
  // Manual (non-Strava) imports have no Strava URL — the source link lives in the prose instead.
  const withUrl = adventure.days.filter((d) => d.activity.stravaUrl);
  if (withUrl.length === 0) return null;
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
          {withUrl.map((d, i) => (
            <span key={d.activity.stravaId}>
              {i > 0 && ', '}
              <a
                href={d.activity.stravaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 dark:hover:text-[#d4d4d4]"
              >
                {adventure.isMultiSport ? 'Leg' : 'Day'} {d.dayIndex + 1}
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
  // Terrain analysis (grade dist + aspect rose) only for steep/ski-type single-activity reports.
  const STEEP_SPORTS = new Set(['BackcountrySki', 'AlpineSki', 'NordicSki', 'Snowboard', 'Snowshoe', 'Mountaineering']);
  const STEEP_TYPES = new Set(['peak', 'scramble', 'traverse', 'mountaineering', 'ski', 'ski-mo', 'high-route']);
  const showTerrain =
    !!track &&
    track.coordinates.length > 1 &&
    (STEEP_SPORTS.has(adventure.sportType) || (adventure.type != null && STEEP_TYPES.has(adventure.type)));
  const epic = [
    formatDistance(adventure.totals.distanceMeters),
    formatElevation(adventure.totals.elevationGainMeters),
    // Manual route imports have no recorded time.
    adventure.totals.movingTimeSeconds > 0 ? formatDuration(adventure.totals.movingTimeSeconds) : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
          {adventure.isMultiSport ? (
            [...new Set(adventure.days.map((d) => d.activity.sportType))].map((s) => (
              <SportBadge key={s} sportType={s} />
            ))
          ) : (
            <SportBadge sportType={adventure.sportType} />
          )}
          {adventure.peakClass && <PeakBadge peakClass={adventure.peakClass} />}
          <span>{formatDate(adventure.date)}</span>
          {adventure.isMultiSport ? (
            <span>· {adventure.days.length} legs</span>
          ) : (
            adventure.isMultiDay && <span>· {adventure.days.length} days</span>
          )}
          {loc && <span>· {loc}</span>}
          {/* Single-day only — a trip's overall weather is meaningless; it lives per-day below. */}
          {!adventure.isMultiDay && adventure.primaryActivity.weather && (
            <WeatherBadge weather={adventure.primaryActivity.weather} />
          )}
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
      {adventure.isMultiDay && (
        <div className="mb-8">
          <TripMap days={adventure.days} photos={adventure.allPhotos} title={adventure.title} />
        </div>
      )}

      {!adventure.isMultiDay && adventure.allPhotos.length > 0 && (
        <div className="mb-8">
          <PhotoGallery photos={adventure.allPhotos} galleryId={`adv-${adventure.slug}`} />
        </div>
      )}

      <AdventureStats stats={adventure.totals} sportType={adventure.sportType} />

      {adventure.primaryActivity.gear && (
        <p className="mt-3 text-sm text-gray-500 dark:text-[#a6a6a6]">
          Gear: {adventure.primaryActivity.gear}
        </p>
      )}

      {adventure.isMultiDay ? (
        <TripElevation days={adventure.days} unit={adventure.isMultiSport ? 'leg' : 'day'} />
      ) : (
        track && track.altitude.length > 1 && <ElevationProfile track={track} />
      )}
      {track && <MetricCharts track={track} />}
      {showTerrain && track && <TerrainAnalysis track={track} />}

      {adventure.isMultiDay && (
        <TripDayBreakdown
          days={adventure.days}
          fallbackSport={adventure.sportType}
          unit={adventure.isMultiSport ? 'leg' : 'day'}
        />
      )}

      {adventure.content.trim() ? (
        <article className="prose mt-8 max-w-none dark:prose-invert">
          <ArticleMarkdown content={adventure.content} />
        </article>
      ) : adventure.primaryActivity.description?.trim() ? (
        // No manual trip report — fall back to the Strava activity description.
        <article className="prose mt-8 max-w-none dark:prose-invert">
          <p className="whitespace-pre-line">{adventure.primaryActivity.description}</p>
        </article>
      ) : null}

      <StravaLinks adventure={adventure} />
    </div>
  );
}
