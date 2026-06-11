/**
 * Format a content date for display.
 *
 * Frontmatter dates like "2026-03-16" parse as UTC midnight, so formatting
 * must stay in UTC or the rendered date is off by one day in timezones
 * west of Greenwich.
 */
export function formatDate(date: string | Date, month: 'long' | 'short' = 'long'): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month,
    day: 'numeric',
    timeZone: 'UTC',
  });
}
