import type { CatalogItem } from '@/lib/adventures';

/** "4.7 mi · 4,508 ft gain · 14,440 ft" with whichever parts exist; null when none do. */
export function statsLine(i: Pick<CatalogItem, 'distanceMi' | 'gainFt' | 'elevationFt'>): string | null {
  const parts: string[] = [];
  if (i.distanceMi != null) parts.push(`${i.distanceMi.toLocaleString('en-US')} mi`);
  if (i.gainFt != null) parts.push(`${i.gainFt.toLocaleString('en-US')} ft gain`);
  if (i.elevationFt != null) parts.push(`${i.elevationFt.toLocaleString('en-US')} ft`);
  return parts.length ? parts.join(' · ') : null;
}

/** '2024-10-13' -> "Oct 2024". */
export function monthYear(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
