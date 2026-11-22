import { Fragment, type ReactNode } from 'react';

/**
 * Inline metadata joined by middots. Each dot is glued to the item before it with a
 * non-breaking space, so a wrapped line never starts with a dot. Empty items are skipped.
 */
export function MetaLine({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== '');
  return (
    <span className={className}>
      {shown.map((item, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {item}
            {i < shown.length - 1 && '\u00a0·'}
          </span>
          {i < shown.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  );
}
