import Link from 'next/link';
import { Check, ExternalLink } from 'lucide-react';
import { regionName } from '../regions';
import { statsLine, monthYear } from './format';
import type { CatalogItem } from '@/lib/adventures';
import type { PageConfig } from '@/lib/objective-schema';

const chipCls =
  'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-[#3a3d41] dark:text-[#cccccc]';

export function CatalogCard({ item, cfg }: { item: CatalogItem; cfg: PageConfig }) {
  const sectionLabels = item.sections.map((id) => cfg.sections.find((s) => s.id === id)?.label ?? id);
  const stats = statsLine(item);
  const sub = [item.location ? regionName(item.location) : null, item.range].filter(Boolean).join(' · ');

  return (
    <div
      className={`rounded-lg border bg-white p-4 dark:bg-[#252526] ${
        item.done
          ? 'border-emerald-200 dark:border-emerald-900/40'
          : 'border-dashed border-gray-300 dark:border-[#3a3d41]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {item.done && (
            <span
              aria-label="Done"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-3.5 w-3.5" />
            </span>
          )}
          <h3 className="font-semibold text-gray-900 dark:text-[#d4d4d4]">
            <Link href={`/adventures/objectives/${item.page}/${item.slug}`} className="hover:underline">
              {item.title}
            </Link>
          </h3>
        </div>
        {item.allLinks[0] && (
          <a
            href={item.allLinks[0].url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Reference for ${item.title}`}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-[#cccccc]"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {sub && <p className="mt-0.5 text-sm text-gray-500 dark:text-[#a6a6a6]">{sub}</p>}
      {stats && (
        <p
          className="mt-2 text-sm tabular-nums text-gray-600 dark:text-[#cccccc]"
          title={item.elevationFt != null ? `${cfg.highPointLabel}: ${item.elevationFt.toLocaleString('en-US')} ft` : undefined}
        >
          {stats}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sectionLabels.map((l) => (
          <span key={l} className={chipCls}>
            {l}
          </span>
        ))}
        {item.multiSport && <span className={chipCls}>Multi-sport</span>}
      </div>
      {item.description && (
        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-[#cccccc]">{item.description}</p>
      )}
      {item.done &&
        (item.reportSlug ? (
          <Link
            href={`/adventures/${item.reportSlug}`}
            className="mt-2 inline-block text-xs text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Done{item.doneDate ? ` ${monthYear(item.doneDate)}` : ''} · trip report →
          </Link>
        ) : (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Done</p>
        ))}
    </div>
  );
}
