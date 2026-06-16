/**
 * Single source of truth for adventure companion frontmatter (content/adventures/*.md).
 *
 * Consumed by:
 *   - scripts/adventure-new.ts      — scaffold valid defaults for a new companion
 *   - scripts/adventure-validate.ts — CI lint that fails the build on a malformed companion
 *
 * The validator runs in CI (`npm run adventure:validate`), so by the time lib/adventures.ts parses
 * a companion at build time it can trust the values are well-formed — this module is the contract.
 *
 * Client-safe: pure constants + a plain validator, no fs/server imports, so it can be imported
 * from the Node scripts AND the build-time adventure layer without pulling in Node-only modules.
 *
 * The `couloir | scramble | traverse | thru-hike` types must stay in sync with FACET_ORDER in
 * lib/facets.ts (those drive the category filter); `peak` and `mountaineering` are classifications
 * that don't get their own facet.
 */

export const ADVENTURE_TYPES = [
  'peak',
  'scramble',
  'traverse',
  'couloir',
  'thru-hike',
  'mountaineering',
] as const;
export type AdventureType = (typeof ADVENTURE_TYPES)[number];

export const PEAK_CLASSES = ['14er', '13er'] as const;
export type PeakClass = (typeof PEAK_CLASSES)[number];

export const DIFFICULTIES = ['moderate', 'hard', 'epic'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Valid `sport` overrides. Mirrors the SportType union in @blog/strava/types (kept as a runtime
 *  array so the validator can use it) plus site-only labels that aren't real Strava sport_types:
 *  `Scramble` (used on Flatirons/peak scrambles). */
export const ADVENTURE_SPORTS = [
  'TrailRun', 'Run', 'Hike', 'Walk', 'Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide',
  'VirtualRide', 'BackcountrySki', 'NordicSki', 'AlpineSki', 'Snowboard', 'Snowshoe', 'Swim',
  'StandUpPaddling', 'Kayaking', 'Canoeing', 'Rowing', 'RockClimbing', 'Mountaineering',
  'Workout', 'Other',
  // Site-only override (not a Strava sport_type):
  'Scramble',
] as const;
export type AdventureSport = (typeof ADVENTURE_SPORTS)[number];

/** Every frontmatter key the parser understands. Anything else is flagged as a likely typo. */
export const COMPANION_KEYS = [
  'hidden', 'strava_id', 'strava_ids', 'source', 'tags', 'type', 'group', 'title', 'sport',
  'laps', 'difficulty', 'race', 'duathlon', 'featured', 'cover_photo', 'days', 'peakClass',
  'objective', 'date',
] as const;

export interface CompanionFrontmatter {
  /** Hide from the library while keeping the activity synced. Present on every companion. */
  hidden?: boolean;
  /** Single Strava activity id. Use this OR strava_ids OR source. */
  strava_id?: number;
  /** Multiple Strava ids for a multi-leg / multi-day outing. */
  strava_ids?: number[];
  /** Non-Strava origin (e.g. "14ers", "pct") — the sync keeps but never fetches these. */
  source?: string;
  tags?: string[];
  type?: AdventureType;
  /** Collapse repeat trips of the same route into one representative card. */
  group?: string;
  /** Override the Strava activity name. */
  title?: string;
  /** Override the sport classification derived from Strava. */
  sport?: AdventureSport;
  laps?: unknown;
  difficulty?: Difficulty;
  race?: boolean;
  duathlon?: boolean;
  featured?: boolean;
  cover_photo?: string | number;
  days?: unknown;
  peakClass?: PeakClass;
  objective?: string;
  date?: string;
}

/**
 * Validate one companion's parsed frontmatter. Returns human-readable error strings
 * (empty array = valid). Pure: never throws, never touches the filesystem.
 */
export function validateCompanionFrontmatter(
  data: Record<string, unknown>,
  file: string,
): string[] {
  const errs: string[] = [];
  const at = (msg: string) => `${file}: ${msg}`;

  // Identification: a Strava id, an id array, or a manual source.
  const hasId = typeof data.strava_id === 'number';
  const hasIds = Array.isArray(data.strava_ids) && data.strava_ids.length > 0;
  const hasSource = typeof data.source === 'string' && (data.source as string).length > 0;
  if (!hasId && !hasIds && !hasSource) {
    errs.push(at('must set strava_id (number), strava_ids (number[]), or source (manual import)'));
  }
  if (data.strava_id !== undefined && typeof data.strava_id !== 'number') {
    errs.push(at('strava_id must be a number'));
  }
  if (
    data.strava_ids !== undefined &&
    (!Array.isArray(data.strava_ids) || (data.strava_ids as unknown[]).some((x) => typeof x !== 'number'))
  ) {
    errs.push(at('strava_ids must be an array of numbers'));
  }

  // Enums.
  if (data.type !== undefined && !(ADVENTURE_TYPES as readonly string[]).includes(data.type as string)) {
    errs.push(at(`type "${String(data.type)}" must be one of: ${ADVENTURE_TYPES.join(', ')}`));
  }
  if (data.sport !== undefined && !(ADVENTURE_SPORTS as readonly string[]).includes(data.sport as string)) {
    errs.push(at(`sport "${String(data.sport)}" is not a recognized SportType`));
  }
  if (data.peakClass !== undefined && !(PEAK_CLASSES as readonly string[]).includes(data.peakClass as string)) {
    errs.push(at(`peakClass "${String(data.peakClass)}" must be one of: ${PEAK_CLASSES.join(', ')}`));
  }
  if (data.difficulty !== undefined && !(DIFFICULTIES as readonly string[]).includes(data.difficulty as string)) {
    errs.push(at(`difficulty "${String(data.difficulty)}" must be one of: ${DIFFICULTIES.join(', ')}`));
  }

  // Booleans.
  for (const key of ['hidden', 'race', 'duathlon', 'featured'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') {
      errs.push(at(`${key} must be true or false`));
    }
  }

  // tags: an array of strings.
  if (
    data.tags !== undefined &&
    (!Array.isArray(data.tags) || (data.tags as unknown[]).some((t) => typeof t !== 'string'))
  ) {
    errs.push(at('tags must be an array of strings'));
  }

  // Free-form string fields.
  for (const key of ['group', 'title', 'objective', 'source', 'date'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'string') {
      errs.push(at(`${key} must be a string`));
    }
  }

  // Unknown keys — almost always a typo (e.g. `tag:` for `tags:`).
  for (const key of Object.keys(data)) {
    if (!(COMPANION_KEYS as readonly string[]).includes(key)) {
      errs.push(at(`unknown key "${key}" — valid keys: ${COMPANION_KEYS.join(', ')}`));
    }
  }

  return errs;
}
