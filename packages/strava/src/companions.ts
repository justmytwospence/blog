/**
 * Pure parsing of report-companion frontmatter — shared by the build-time read API
 * (lib/adventures) and the sync/inbox scripts so the id-extraction logic never drifts.
 */

/** Extract the Strava activity id(s) a companion references (`strava_ids` array wins over `strava_id`). */
export function parseStravaIds(fm: Record<string, unknown>): number[] {
  const raw = fm.strava_ids ?? fm.strava_id;
  const out: number[] = [];
  const push = (v: unknown): void => {
    const n = Number(v);
    if (v != null && v !== '' && !Number.isNaN(n)) out.push(n);
  };
  if (Array.isArray(raw)) raw.forEach(push);
  else if (raw != null) push(raw);
  return out;
}

/** True when the companion used the `strava_ids` array form (→ treat as a multi-day trip). */
export function usesIdArray(fm: Record<string, unknown>): boolean {
  return Array.isArray(fm.strava_ids);
}
