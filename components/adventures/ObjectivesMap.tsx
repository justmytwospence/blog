'use client';

import dynamic from 'next/dynamic';
import type { Objective } from '@/lib/adventures';

const ObjectivesMapInner = dynamic(
  () => import('./ObjectivesMapInner').then((m) => m.ObjectivesMapInner),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-[#252526]" />,
  },
);

export function ObjectivesMap({
  objectives,
  onRegionClick,
}: {
  objectives: Objective[];
  onRegionClick?: (code: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Objectives by region"
      className="h-[360px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-[#303031]"
    >
      <ObjectivesMapInner objectives={objectives} onRegionClick={onRegionClick} />
    </div>
  );
}
