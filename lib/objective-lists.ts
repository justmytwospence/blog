/**
 * Client-safe constants and types for the named objective checklists (14ers, Seven Summits, etc.) so
 * both the build-time adventure layer and the client-side ObjectivesView can share them — mirrors
 * lib/facets.ts (no fs/server imports). Order drives the primary pill row; labels are display strings.
 */
export const LIST_ORDER = [
  '14ers',
  'seven-summits',
  'state-high-points',
  'thru-hikes',
  'bikepacks',
] as const;

export type ObjectiveListId = (typeof LIST_ORDER)[number];

export const LIST_LABELS: Record<string, string> = {
  '14ers': '14ers',
  'seven-summits': 'Seven Summits',
  'state-high-points': 'State High Points',
  'thru-hikes': 'Thru-Hikes',
  bikepacks: 'Bikepacks',
};

/** A single canonical checklist item (a peak, trail, or route) with done/todo status. */
export interface ObjectiveListItem {
  name: string;
  detail: string; // elevation/range, miles, or continent — a one-line subtitle
  region: string | null; // short code / state abbreviation, when meaningful
  done: boolean;
  completedSlug: string | null; // adventure slug when done → /adventures/<slug>
}

/** A named checklist (e.g. "14ers") of canonical items. */
export interface ObjectiveList {
  id: string;
  label: string;
  note: string;
  items: ObjectiveListItem[];
}
