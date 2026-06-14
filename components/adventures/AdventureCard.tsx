import Link from 'next/link';
import { Star } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';
import { SportBadge } from './SportBadge';
import { PeakBadge } from './PeakBadge';
import { RouteThumb } from './RouteThumb';
import { sportColor } from './mapStyle';
import type { AdventureSummary } from '@/lib/adventures';

export function AdventureCard({ adventure }: { adventure: AdventureSummary }) {
  const rating = adventure.rating;
  const place = [adventure.location.city, adventure.location.state ?? adventure.location.country]
    .filter(Boolean)
    .join(', ');
  const route = adventure.summaryPolyline;
  const routeImg = adventure.routeThumb;
  const hasRouteBase = Boolean(routeImg || route);

  return (
    <Link
      href={`/adventures/${adventure.slug}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg dark:border-[#303031] dark:bg-[#252526]"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#2a2a2b] dark:to-[#1e1e1e]">
        {/* Route as the base layer — a static basemap+route image if synced, else a bare SVG shape.
            Shown when there's no photo, and revealed on hover when there is. */}
        {routeImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={routeImg} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : route ? (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <RouteThumb polyline={route} stroke={sportColor(adventure.sportType)} className="h-full w-full opacity-80" />
          </div>
        ) : null}
        {adventure.coverThumb && (
          // Local static image; intrinsic next/image isn't needed for a fixed-height cover.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={adventure.coverThumb}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover ${
              hasRouteBase ? 'transition-opacity duration-300 group-hover:opacity-0' : ''
            }`}
          />
        )}
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <SportBadge sportType={adventure.sportType} size="sm" />
          {adventure.peakClass && <PeakBadge peakClass={adventure.peakClass} />}
          {adventure.facets.includes('race') && (
            <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-300">
              Race
            </span>
          )}
          {adventure.isMultiDay && !adventure.isMultiSport && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-[#3a3d41] dark:text-[#cccccc]">
              {adventure.dayCount} days
            </span>
          )}
          {adventure.tripCount > 1 && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {adventure.tripCount} trips
            </span>
          )}
          <span className="ml-auto text-sm text-gray-500 dark:text-[#a6a6a6]">
            {formatDate(adventure.date, 'short')}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-[#d4d4d4] dark:group-hover:text-blue-400">
          {adventure.title}
        </h3>
        {place && <p className="mt-0.5 text-sm text-gray-500 dark:text-[#a6a6a6]">{place}</p>}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums text-gray-600 dark:text-[#cccccc]">
          <span>{formatDistance(adventure.totals.distanceMeters)}</span>
          <span>{formatElevation(adventure.totals.elevationGainMeters)} gain</span>
          <span>{formatDuration(adventure.totals.movingTimeSeconds)}</span>
        </div>
        {(rating != null || adventure.type) && (
          <div className="mt-3 flex items-center gap-2">
            {rating != null && (
              <span
                className="inline-flex items-center gap-0.5 text-amber-500"
                aria-label={`Rated ${rating} out of 5`}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-current' : 'opacity-30'}`} />
                ))}
              </span>
            )}
            {adventure.type && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-[#3a3d41] dark:text-[#cccccc]">
                {adventure.type}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
