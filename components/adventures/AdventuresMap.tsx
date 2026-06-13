'use client';

import dynamic from 'next/dynamic';
import type { AdventureSummary } from '@/lib/adventures';

const AdventuresMapInner = dynamic(
  () => import('./AdventuresMapInner').then((m) => m.AdventuresMapInner),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
  },
);

export function AdventuresMap({ items }: { items: AdventureSummary[] }) {
  return (
    <div
      role="group"
      aria-label="Map of all adventures"
      className="h-[70vh] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031]"
    >
      <AdventuresMapInner items={items} />
    </div>
  );
}
