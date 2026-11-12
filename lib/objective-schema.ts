/**
 * Client-safe schema for the public objectives catalog (`content/objectives/<slug>.md`): the page and
 * section vocabulary, the frontmatter validator, and the parser. No fs/path imports: the client-side
 * catalog view imports page config from here. The repo is public, so this schema carries no
 * private-plan fields (priorities, dates, status); those live in the Obsidian plan note.
 */

export type SortKey = 'name' | 'distance' | 'gain' | 'elevation' | 'done';
export type PageId = 'peaks' | 'backpacking' | 'scrambles' | 'cycling' | 'skiing' | 'races';

export interface SectionConfig {
  id: string;
  label: string;
}
export interface PageConfig {
  id: PageId;
  label: string;
  blurb: string;
  sections: SectionConfig[];
  defaultSort: SortKey;
  highPointLabel: string;
}

export const OBJECTIVE_PAGES = [
  {
    id: 'peaks',
    label: 'Peaks',
    blurb: 'Fourteeners, Cascade volcanoes, the Seven Summits and the state high points.',
    defaultSort: 'elevation',
    highPointLabel: 'Summit',
    sections: [
      { id: '14ers', label: '14ers' },
      { id: 'cascade-volcanoes', label: 'Cascade Volcanoes' },
      { id: 'seven-summits', label: 'Seven Summits' },
      { id: 'state-high-points', label: 'State High Points' },
      { id: 'more-peaks', label: 'More Peaks' },
    ],
  },
  {
    id: 'backpacking',
    label: 'Backpacking',
    blurb: 'Thru-hikes, high routes and fastpacks.',
    defaultSort: 'distance',
    highPointLabel: 'High point',
    sections: [
      { id: 'thru-hikes', label: 'Thru-Hikes' },
      { id: 'high-routes', label: 'High Routes' },
      { id: 'fastpacking', label: 'Fastpacking' },
    ],
  },
  {
    id: 'scrambles',
    label: 'Scrambles & Traverses',
    blurb: 'Ridges, scrambles, couloirs and big linkups.',
    defaultSort: 'name',
    highPointLabel: 'High point',
    sections: [
      { id: 'scrambles', label: 'Scrambles' },
      { id: 'traverses', label: 'Traverses & Linkups' },
      { id: 'couloirs', label: 'Couloirs' },
    ],
  },
  {
    id: 'cycling',
    label: 'Cycling',
    blurb: 'Bikepacking routes, tours and big days on the bike.',
    defaultSort: 'distance',
    highPointLabel: 'High point',
    sections: [
      { id: 'bikepacking', label: 'Bikepacking & Tours' },
      { id: 'big-days', label: 'Big Days' },
    ],
  },
  {
    id: 'skiing',
    label: 'Skiing',
    blurb: 'Ski descents and ski tours.',
    defaultSort: 'name',
    highPointLabel: 'High point',
    sections: [
      { id: 'ski-descents', label: 'Ski Descents' },
      { id: 'tours', label: 'Tours' },
    ],
  },
  {
    id: 'races',
    label: 'Races',
    blurb: 'Races run, skied and ridden, and the ones still on the list.',
    defaultSort: 'done',
    highPointLabel: 'High point',
    sections: [
      { id: 'trail-ultra', label: 'Trail & Ultra' },
      { id: 'road-running', label: 'Road Running' },
      { id: 'xc-ski', label: 'Nordic' },
      { id: 'skimo', label: 'Skimo' },
      { id: 'cycling', label: 'Cycling' },
      { id: 'multisport', label: 'Multisport' },
    ],
  },
] as const satisfies readonly PageConfig[];

export const PAGE_IDS: PageId[] = OBJECTIVE_PAGES.map((p) => p.id);

export function pageConfig(id: string): PageConfig | null {
  return (OBJECTIVE_PAGES as readonly PageConfig[]).find((p) => p.id === id) ?? null;
}

export const OBJECTIVE_SEASONS = ['spring', 'summer', 'fall', 'winter', 'year-round'] as const;

export const OBJECTIVE_KEYS = [
  'title',
  'page',
  'sections',
  'location',
  'range',
  'season',
  'distance_mi',
  'gain_ft',
  'elevation_ft',
  'lat',
  'lng',
  'link',
  'multi_sport',
  'completed_by',
  'completed',
] as const;

/** Parsed file, before report derivation. */
export interface ObjectiveSource {
  slug: string;
  title: string;
  page: PageId;
  sections: string[];
  location: string | null;
  range: string | null;
  season: string[];
  distanceMi: number | null;
  gainFt: number | null;
  elevationFt: number | null;
  lat: number | null;
  lng: number | null;
  link: string | null;
  multiSport: boolean;
  completedBy: string | null;
  completed: boolean;
  description: string | null;
}

/** What the pages render (derived in lib/adventures.ts). */
export interface CatalogItem extends Omit<ObjectiveSource, 'completedBy' | 'completed'> {
  done: boolean;
  reportSlug: string | null;
  doneDate: string | null;
  polylines: string[];
}

const isPosNum = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isNonEmptyStr = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/**
 * Validate one objective file's parsed frontmatter. Returns `${file}: <msg>` strings (empty = valid).
 * Pure: never throws, never touches the filesystem.
 */
export function validateObjectiveFrontmatter(data: Record<string, unknown>, file: string): string[] {
  const errs: string[] = [];
  const at = (msg: string) => `${file}: ${msg}`;

  for (const key of Object.keys(data)) {
    if (!(OBJECTIVE_KEYS as readonly string[]).includes(key)) errs.push(at(`unknown key \`${key}\``));
  }

  if (!isNonEmptyStr(data.title)) errs.push(at('missing title'));

  const cfg = typeof data.page === 'string' ? pageConfig(data.page) : null;
  if (data.page === undefined) errs.push(at('missing page'));
  else if (!cfg) errs.push(at(`invalid page \`${String(data.page)}\``));

  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    errs.push(at('missing sections'));
  } else if (cfg) {
    for (const s of data.sections as unknown[]) {
      if (!cfg.sections.some((c) => c.id === s)) {
        errs.push(at(`invalid section \`${String(s)}\` for page \`${cfg.id}\``));
      }
    }
  }

  for (const key of ['location', 'range', 'completed_by'] as const) {
    if (data[key] !== undefined && !isNonEmptyStr(data[key])) errs.push(at(`${key} must be a non-empty string`));
  }

  if (data.season !== undefined) {
    if (!Array.isArray(data.season)) errs.push(at(`invalid season \`${String(data.season)}\``));
    else
      for (const s of data.season as unknown[]) {
        if (!(OBJECTIVE_SEASONS as readonly unknown[]).includes(s)) errs.push(at(`invalid season \`${String(s)}\``));
      }
  }

  for (const key of ['distance_mi', 'gain_ft', 'elevation_ft'] as const) {
    if (data[key] !== undefined && !isPosNum(data[key])) errs.push(at(`invalid ${key} \`${String(data[key])}\``));
  }

  const latOk = typeof data.lat === 'number' && Math.abs(data.lat) <= 90;
  const lngOk = typeof data.lng === 'number' && Math.abs(data.lng) <= 180;
  if ((data.lat === undefined) !== (data.lng === undefined)) {
    errs.push(at('lat and lng must be set together'));
  } else {
    if (data.lat !== undefined && !latOk) errs.push(at(`invalid lat \`${String(data.lat)}\``));
    if (data.lng !== undefined && !lngOk) errs.push(at(`invalid lng \`${String(data.lng)}\``));
  }

  if (data.link !== undefined && !(typeof data.link === 'string' && data.link.startsWith('https://'))) {
    errs.push(at('link must be https'));
  }

  for (const key of ['multi_sport', 'completed'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') errs.push(at(`${key} must be true or false`));
  }

  return errs;
}

/** Map validated frontmatter + body to an ObjectiveSource. Assumes `validateObjectiveFrontmatter` passed. */
export function parseObjective(slug: string, data: Record<string, unknown>, body: string): ObjectiveSource {
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const description = body.trim();
  return {
    slug,
    title: String(data.title),
    page: data.page as PageId,
    sections: Array.isArray(data.sections) ? (data.sections as string[]) : [],
    location: str(data.location),
    range: str(data.range),
    season: Array.isArray(data.season) ? (data.season as string[]) : [],
    distanceMi: num(data.distance_mi),
    gainFt: num(data.gain_ft),
    elevationFt: num(data.elevation_ft),
    lat: num(data.lat),
    lng: num(data.lng),
    link: str(data.link),
    multiSport: data.multi_sport === true,
    completedBy: str(data.completed_by),
    completed: data.completed === true,
    description: description === '' ? null : description,
  };
}
