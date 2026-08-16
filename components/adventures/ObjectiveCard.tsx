import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { regionName } from './regionCentroids';
import type { Objective } from '@/lib/adventures';

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600 dark:bg-[#3a3d41] dark:text-[#cccccc]">
      {children}
    </span>
  );
}

export function ObjectiveCard({ objective: o }: { objective: Objective }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 dark:border-[#3a3d41] dark:bg-[#252526]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-[#d4d4d4]">{o.title}</h3>
        {o.link && (
          <a
            href={o.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Reference for ${o.title}`}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-[#cccccc]"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {o.location && <p className="mt-0.5 text-sm text-gray-500 dark:text-[#a6a6a6]">{regionName(o.location)}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {o.type && <Chip>{o.type}</Chip>}
        {o.grade && <Chip>{o.grade}</Chip>}
        {(o.season ?? []).map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
      </div>
      {(o.distanceMi != null || o.elevationGainFt != null) && (
        <p className="mt-2 text-sm tabular-nums text-gray-600 dark:text-[#cccccc]">
          {o.distanceMi != null ? `${o.distanceMi} mi` : ''}
          {o.distanceMi != null && o.elevationGainFt != null ? ' · ' : ''}
          {o.elevationGainFt != null ? `${o.elevationGainFt.toLocaleString()} ft` : ''}
        </p>
      )}
      {o.notes && <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-[#cccccc]">{o.notes}</p>}
      {o.completedSlug && (
        <Link
          href={`/adventures/${o.completedSlug}`}
          className="mt-2 inline-block text-xs text-emerald-600 dark:text-emerald-400"
        >
          ✓ Completed — see the report
        </Link>
      )}
    </div>
  );
}
