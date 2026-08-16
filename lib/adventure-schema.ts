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

// Type-only: erased at compile time, so this module stays runtime-free and client-safe.
import type { SportType } from '@blog/strava/types';

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

/** Site-only sport labels that are deliberately NOT Strava sport_types — they can only ever arrive
 *  via a `sport:` frontmatter override, never from mapSportType. */
export const SITE_ONLY_SPORTS = ['Scramble'] as const;
export type SiteOnlySport = (typeof SITE_ONLY_SPORTS)[number];

/** Valid `sport` overrides: every Strava SportType, plus the site-only labels. Kept as a runtime
 *  array so the validator can check against it. */
export const ADVENTURE_SPORTS = [
  'TrailRun', 'Run', 'Hike', 'Walk', 'Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide',
  'VirtualRide', 'BackcountrySki', 'NordicSki', 'AlpineSki', 'Snowboard', 'Snowshoe', 'Swim',
  'StandUpPaddling', 'Kayaking', 'Canoeing', 'Rowing', 'RockClimbing', 'Mountaineering',
  'Workout', 'Other',
  // Site-only override (not a Strava sport_type):
  'Scramble',
] as const satisfies readonly (SportType | SiteOnlySport)[];
export type AdventureSport = (typeof ADVENTURE_SPORTS)[number];

/**
 * Compile-time drift guards between this list and @blog/strava's SportType union.
 *
 * The `satisfies` above catches one direction — an entry here that is neither a Strava SportType nor
 * a declared site-only label. This catches the other: a SportType added upstream and never listed
 * here, which would otherwise make the CI validator reject a sport lib/adventures accepts. The
 * failure is a type error naming the missing members.
 */
type MissingSportTypes = Exclude<SportType, AdventureSport>;
type AdventureSportsCoverSportType = [MissingSportTypes] extends [never]
  ? true
  : ['ADVENTURE_SPORTS is missing these SportType members:', MissingSportTypes];
const _adventureSportsInSync: AdventureSportsCoverSportType = true;
void _adventureSportsInSync;

/** Narrow an untrusted `sport:` frontmatter value to the vocabulary the site can render. */
export function isAdventureSport(v: unknown): v is AdventureSport {
  return typeof v === 'string' && (ADVENTURE_SPORTS as readonly string[]).includes(v);
}

/** Sports where a summit elevation means a peak was bagged (so a 14er/13er badge is meaningful). */
export const SUMMIT_SPORTS: ReadonlySet<string> = new Set<AdventureSport>([
  'Hike',
  'Mountaineering',
  'TrailRun',
  'RockClimbing',
  'BackcountrySki',
  'AlpineSki',
  'Snowboard',
  'Snowshoe',
]);

/** `type` values that imply a summit objective — ADVENTURE_TYPES minus `thru-hike`. */
export const PEAKISH_TYPES: ReadonlySet<string> = new Set<AdventureType>([
  'peak',
  'couloir',
  'scramble',
  'traverse',
  'mountaineering',
]);

/**
 * Classify an outing's high point as a 14er/13er. An explicit `peakClass` override wins (used for the
 * few imported summits whose GPX high point falls just under the line); otherwise derive from the
 * summit elevation, but only for summit-style outings so a bike ride or road race that happens to
 * climb high isn't mislabeled.
 *
 * `sport` is widened to `string | null` so the taxonomy migration — which reads it off frontmatter or
 * a snapshot, untyped — shares this exact implementation instead of replicating it.
 */
export function derivePeakClass(
  explicit: string | null,
  type: string | null,
  sport: string | null,
  elevHighMeters: number,
): PeakClass | null {
  if (explicit === '14er' || explicit === '13er') return explicit;
  // A thru-hike crosses high passes without bagging a peak — don't badge it.
  if (type === 'thru-hike') return null;
  const peakish = (type != null && PEAKISH_TYPES.has(type)) || (sport != null && SUMMIT_SPORTS.has(sport));
  if (!peakish || !Number.isFinite(elevHighMeters)) return null;
  const ft = elevHighMeters * 3.28084;
  if (ft >= 14000) return '14er';
  if (ft >= 13000) return '13er';
  return null;
}

/**
 * True for a report-companion markdown file under content/adventures.
 *
 * The single definition of "what is a companion file" — the build-time reader and every author
 * script filter through this. Dotfiles are skipped deliberately: macOS writes AppleDouble `._foo.md`
 * siblings on non-APFS volumes, and gray-matter chokes on their binary contents.
 */
export function isCompanionFile(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.');
}

/** Every frontmatter key the parser understands. Anything else is flagged as a likely typo. */
export const COMPANION_KEYS = [
  'hidden', 'strava_id', 'strava_ids', 'source', 'tags', 'type', 'group', 'title', 'sport',
  'laps', 'race', 'duathlon', 'featured', 'cover_photo', 'days', 'peakClass',
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
