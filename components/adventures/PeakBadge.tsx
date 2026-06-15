import type { PeakClass } from '@/lib/adventures';

// 14ers get a gold tint (the marquee achievement); 13ers a neutral one.
const STYLES: Record<PeakClass, string> = {
  '14er':
    'border-amber-400/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300',
  '13er':
    'border-gray-300 bg-gray-50 text-gray-600 dark:border-[#3a3d41] dark:bg-[#2a2a2b] dark:text-[#cccccc]',
};

export function PeakBadge({ peakClass, className = '' }: { peakClass: PeakClass; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[peakClass]} ${className}`}
    >
      {peakClass}
    </span>
  );
}
