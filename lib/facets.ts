/**
 * Client-safe facet constants (no fs/server imports) so both the build-time adventure layer and
 * the client-side LibraryView can share them. Order drives the category filter; labels are display.
 */
export const FACET_ORDER = [
  '14er',
  '13er',
  'race',
  'duathlon',
  'couloir',
  'scramble',
  'traverse',
  'thru-hike',
] as const;

export const FACET_LABELS: Record<string, string> = {
  '14er': '14ers',
  '13er': '13ers',
  race: 'Races',
  duathlon: 'Duathlons',
  couloir: 'Couloirs',
  scramble: 'Scrambles',
  traverse: 'Traverses',
  'thru-hike': 'Thru-hikes',
};
