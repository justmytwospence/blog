import Link from 'next/link';
import { Check, ExternalLink } from 'lucide-react';
import { regionName } from '../regions';
import { monthYear } from './format';
import { CatalogMap } from './CatalogMap';
import { RouteMap } from '../RouteMap';
import { ElevationProfile } from '../ElevationProfile';
import { TripMap } from '../TripMap';
import { TripElevation } from '../TripElevation';
import type { Adventure, CatalogItem, ObjectiveRoute } from '@/lib/adventures';
import { routeSourceNote, type PageConfig } from '@/lib/objective-schema';

const chipCls =
  'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-[#3a3d41] dark:text-[#cccccc]';
const tileCls = 'rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#303031] dark:bg-[#252526]';
const tileValueCls = 'text-2xl font-bold tabular-nums text-gray-900 dark:text-[#d4d4d4]';
const tileLabelCls = 'mt-0.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[#a6a6a6]';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function ObjectiveDetail({
  item,
  cfg,
  route,
  report,
}: {
  item: CatalogItem;
  cfg: PageConfig;
  route: ObjectiveRoute | null;
  report: Adventure | null;
}) {
  const sectionLabels = item.sections.map((id) => cfg.sections.find((s) => s.id === id)?.label ?? id);
  const sub = [item.location ? regionName(item.location) : null, item.range].filter(Boolean).join(' · ');
  const tiles: Array<{ value: string; label: string }> = [];
  if (item.distanceMi != null) tiles.push({ value: `${item.distanceMi.toLocaleString('en-US')} mi`, label: 'Distance' });
  if (item.gainFt != null) tiles.push({ value: `${item.gainFt.toLocaleString('en-US')} ft`, label: 'Gain' });
  if (item.elevationFt != null) tiles.push({ value: `${item.elevationFt.toLocaleString('en-US')} ft`, label: cfg.highPointLabel });
  if (item.season.length) tiles.push({ value: item.season.map(cap).join(', '), label: 'Season' });

  const reportTrack = report && !report.isMultiDay ? report.primaryActivity.track : null;

  return (
    <>
      <Link
        href={`/adventures/objectives/${cfg.id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#a6a6a6] dark:hover:text-[#d4d4d4]"
      >
        ← {cfg.label}
      </Link>

      <header className="mb-6">
        {item.done && (
          <p className="mb-2 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15"
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            Done{item.doneDate ? ` ${monthYear(item.doneDate)}` : ''}
          </p>
        )}
        <h1 className="text-4xl font-bold text-gray-900 dark:text-[#d4d4d4]">{item.title}</h1>
        {sub && <p className="mt-1 text-lg text-gray-600 dark:text-[#cccccc]">{sub}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sectionLabels.map((l) => (
            <span key={l} className={chipCls}>
              {l}
            </span>
          ))}
          {item.multiSport && <span className={chipCls}>Multi-sport</span>}
        </div>
        {item.routeName && (
          <p className="mt-3 text-gray-700 dark:text-[#cccccc]">
            <span className="font-medium">Route:</span> {item.routeName}
          </p>
        )}
        {route && (
          <p className="mt-1 text-xs text-gray-500 dark:text-[#a6a6a6]">{routeSourceNote(route.kind, route.approx)}</p>
        )}
      </header>

      {tiles.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className={tileCls}>
              <div className={tileValueCls}>{t.value}</div>
              <div className={tileLabelCls}>{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {report ? (
        <>
          {reportTrack && reportTrack.coordinates.length > 1 && (
            <div className="mb-8">
              <RouteMap track={reportTrack} photos={report.allPhotos} title={report.title} />
            </div>
          )}
          {report.isMultiDay && (
            <div className="mb-8">
              <TripMap days={report.days} photos={report.allPhotos} title={report.title} />
            </div>
          )}
          {report.isMultiDay ? (
            <TripElevation days={report.days} unit={report.isMultiSport ? 'leg' : 'day'} />
          ) : (
            reportTrack && reportTrack.altitude.length > 1 && <ElevationProfile track={reportTrack} />
          )}
          <p className="mb-8">
            <Link
              href={`/adventures/${report.slug}`}
              className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Trip report →
            </Link>
          </p>
        </>
      ) : route ? (
        <>
          <div className="mb-8">
            <RouteMap track={route.track} title={item.title} />
          </div>
          <ElevationProfile track={route.track} />
        </>
      ) : (
        <div className="mb-8">
          <CatalogMap items={[item]} />
        </div>
      )}

      {item.description && (
        <p className="mb-8 max-w-3xl text-gray-700 dark:text-[#cccccc]">{item.description}</p>
      )}

      {item.allLinks.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-[#d4d4d4]">Links</h2>
          <ul className="space-y-1.5">
            {item.allLinks.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                >
                  {l.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
