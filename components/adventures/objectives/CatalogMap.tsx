'use client';

import dynamic from 'next/dynamic';
import type { CatalogItem } from '@/lib/adventures';

const CatalogMapInner = dynamic(() => import('./CatalogMapInner').then((m) => m.CatalogMapInner), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
});

export function CatalogMap({ items }: { items: CatalogItem[] }) {
  return (
    <div
      role="group"
      aria-label="Objectives map"
      className="relative h-[520px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031]"
    >
      <CatalogMapInner items={items} />
      <div className="pointer-events-none absolute right-2 top-2 z-[1000] flex items-center gap-3 rounded-md bg-white/90 px-2.5 py-1.5 text-xs text-gray-700 shadow dark:bg-[#252526]/90 dark:text-[#cccccc]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Done
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> To do
        </span>
      </div>
    </div>
  );
}
