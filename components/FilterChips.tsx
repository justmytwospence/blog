import type { ReactNode } from 'react';

/** One pill style for every filter-chip row (Adventures sports, Objectives sections, Projects topics). */
export function chipClass(active: boolean, linked = false): string {
  const base = 'whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ';
  if (active) return base + 'bg-gray-900 text-white dark:bg-[#d4d4d4] dark:text-[#1e1e1e]';
  if (linked) {
    return (
      base +
      'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-500 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400'
    );
  }
  return (
    base +
    'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#3a3d41] dark:text-[#cccccc] dark:hover:bg-[#454545]'
  );
}

export function ChipCount({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-xs tabular-nums opacity-70">{children}</span>;
}

/** A single swipeable row below md, wrapping from md up. Callers add the page-edge bleed. */
export function ChipRow({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 md:flex-wrap md:overflow-visible ${className}`}
    >
      {children}
    </div>
  );
}
