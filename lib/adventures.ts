/**
 * Build-time read API for the Adventures section. Reads ONLY local files (committed snapshot
 * under data/adventures + report companions under content/adventures) — no Strava at build.
 * Reuses lib/content.ts helpers; mirrors its catch-and-skip-malformed, date-desc posture.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { mapCommonMetadata, normalizeDate } from './content';
import { preprocessObsidian } from '@blog/obsidian-md';
import type { AdventureActivity, AdventureStats, SportType } from '@blog/strava/types';
import { parseStravaIds, usesIdArray } from '@blog/strava';

export type {
  AdventureActivity,
  AdventureStats,
  SportType,
  AdventureTrack,
  AdventureWeather,
} from '@blog/strava/types';

const ADVENTURES_DIR = path.join(process.cwd(), 'content', 'adventures');
const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'adventures');
const ACTIVITIES_DIR = path.join(SNAPSHOT_DIR, 'activities');
const OBJECTIVES_FILE = path.join(SNAPSHOT_DIR, 'objectives.json');
const YEARLY_FILE = path.join(SNAPSHOT_DIR, 'yearly-totals.json');

// ─── Public types ──────────────────────────────────────────────────

export interface ResolvedPhoto {
  src: string; // public path to the display image
  thumb: string; // public path to the thumbnail
  width: number;
  height: number;
  caption: string | null;
  lat: number | null;
  lng: number | null;
}

export interface AdventureDay {
  dayIndex: number;
  title: string | null;
  caption: string | null;
  activity: AdventureActivity;
  photos: ResolvedPhoto[];
}

/** A summit-elevation classification surfaced as a badge ("14er"/"13er"). */
export type PeakClass = '14er' | '13er';

export interface Adventure {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  sportType: SportType;
  isMultiDay: boolean;
  isMultiSport: boolean; // multiple activities on the SAME day (e.g. a triathlon) — legs, not days
  featured: boolean;
  hidden: boolean;
  description: string;
  categories: string[];
  tags: string[];
  type: string | null;
  difficulty: string | null;
  grade: string | null;
  peakClass: PeakClass | null;
  rating: number | null;
  objective: string | null; // slug of fulfilled objective
  coverPhoto: ResolvedPhoto | null;
  content: string; // prose markdown (Obsidian-preprocessed)
  totals: AdventureStats; // aggregate across member activities
  location: { city: string | null; state: string | null; country: string | null };
  days: AdventureDay[]; // length 1 for single-activity
  allPhotos: ResolvedPhoto[];
  primaryActivity: AdventureActivity;
}

export interface AdventureSummary {
  slug: string;
  title: string;
  date: string;
  sportType: SportType;
  isMultiDay: boolean;
  featured: boolean;
  description: string;
  type: string | null;
  difficulty: string | null;
  peakClass: PeakClass | null;
  rating: number | null;
  tags: string[];
  location: { city: string | null; state: string | null; country: string | null };
  coverThumb: string | null;
  summaryPolyline: string | null;
  routeThumb: string | null; // committed static map (basemap + route), if synced
  isMultiSport: boolean;
  dayCount: number;
  totals: Pick<AdventureStats, 'distanceMeters' | 'elevationGainMeters' | 'movingTimeSeconds'>;
}

export interface SportTotals {
  sportType: SportType;
  count: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

export interface LifetimeStats {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  adventureCount: number;
  bySport: SportTotals[];
  states: string[];
  countries: string[];
  records: {
    longestDistance: AdventureSummary | null;
    mostVert: AdventureSummary | null;
    longestDuration: AdventureSummary | null;
    highestPoint: { meters: number; slug: string; title: string } | null;
  };
}

export interface Objective {
  slug: string;
  title: string;
  type: string | null;
  location: string | null;
  difficulty: string | null;
  grade: string | null;
  season: string[];
  distanceMi: number | null;
  elevationGainFt: number | null;
  status: string;
  dateCompleted: string | null;
  link: string | null;
  multiSport: boolean;
  completedSlug: string | null;
  notes: string | null;
}

export interface ObjectivesData {
  objectives: Objective[];
}

// ─── Helpers ───────────────────────────────────────────────────────

export function photoUrl(stravaId: number, file: string): string {
  return `/adventures/${stravaId}/${file}`;
}
export function photoThumb(stravaId: number, file: string): string {
  return `/adventures/${stravaId}/${file.replace(/\.jpg$/, '-thumb.jpg')}`;
}

function str(v: unknown): string | null {
  return v != null && v !== '' ? String(v) : null;
}
function num(v: unknown): number | null {
  const n = Number(v);
  return v != null && v !== '' && !Number.isNaN(n) ? n : null;
}

// Sports where a summit elevation means a peak was bagged (so a 14er/13er badge is meaningful).
const SUMMIT_SPORTS = new Set<SportType>([
  'Hike',
  'Mountaineering',
  'TrailRun',
  'RockClimbing',
  'BackcountrySki',
  'AlpineSki',
  'Snowboard',
  'Snowshoe',
]);
const PEAKISH_TYPES = new Set(['peak', 'couloir', 'scramble', 'traverse', 'mountaineering']);

/**
 * Classify an outing's high point as a 14er/13er. The `14er` tag (on every imported 14er) is
 * authoritative; otherwise derive from the summit elevation, but only for summit-style outings so
 * a bike ride or road race that happens to climb high isn't mislabeled. An explicit `13er` tag wins.
 */
function derivePeakClass(
  tags: string[],
  type: string | null,
  sport: SportType,
  elevHighMeters: number,
): PeakClass | null {
  if (tags.includes('14er')) return '14er';
  if (tags.includes('13er')) return '13er';
  // A thru-hike or point-to-point race crosses high passes without bagging a peak — don't badge it.
  if (type === 'thru-hike' || type === 'race') return null;
  const peakish = (type != null && PEAKISH_TYPES.has(type)) || SUMMIT_SPORTS.has(sport);
  if (!peakish || !Number.isFinite(elevHighMeters)) return null;
  const ft = elevHighMeters * 3.28084;
  if (ft >= 14000) return '14er';
  if (ft >= 13000) return '13er';
  return null;
}

function readActivity(id: number): AdventureActivity | null {
  const p = path.join(ACTIVITIES_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as AdventureActivity;
  } catch (err) {
    console.error(`[adventures] bad activity json ${id}:`, err);
    return null;
  }
}

function resolvePhotos(a: AdventureActivity): ResolvedPhoto[] {
  return a.photos.map((p) => ({
    src: photoUrl(a.stravaId, p.file),
    thumb: photoThumb(a.stravaId, p.file),
    width: p.width,
    height: p.height,
    caption: p.caption,
    lat: p.lat,
    lng: p.lng,
  }));
}

/** Aggregate stats across the member activities of a (possibly multi-day) adventure. */
export function computeTotals(acts: AdventureActivity[]): AdventureStats {
  if (acts.length === 1) return acts[0].stats;
  const st = acts.map((a) => a.stats);
  const sum = (vals: Array<number | null | undefined>): number =>
    vals.reduce<number>((t, v) => t + (v ?? 0), 0);
  const present = (sel: (x: AdventureStats) => number | null): number[] =>
    st.map(sel).filter((v): v is number => v != null);

  const distanceMeters = sum(st.map((x) => x.distanceMeters));
  const movingTimeSeconds = sum(st.map((x) => x.movingTimeSeconds));
  const elapsedTimeSeconds = sum(st.map((x) => x.elapsedTimeSeconds));
  const elevationGainMeters = sum(st.map((x) => x.elevationGainMeters));

  const timeWeighted = (sel: (x: AdventureStats) => number | null): number | null => {
    const items = st.filter((x) => sel(x) != null);
    const t = sum(items.map((x) => x.movingTimeSeconds));
    if (!items.length || t <= 0) return null;
    return sum(items.map((x) => (sel(x) as number) * x.movingTimeSeconds)) / t;
  };

  const maxHr = present((x) => x.maxHeartrate);
  const elevHi = present((x) => x.elevHighMeters);
  const elevLo = present((x) => x.elevLowMeters);
  const maxW = present((x) => x.maxWatts);
  const cal = present((x) => x.calories);
  const suf = present((x) => x.sufferScore);
  const maxSpd = present((x) => x.maxSpeedMetersPerSec);

  return {
    distanceMeters,
    movingTimeSeconds,
    elapsedTimeSeconds,
    elevationGainMeters,
    elevHighMeters: elevHi.length ? Math.max(...elevHi) : null,
    elevLowMeters: elevLo.length ? Math.min(...elevLo) : null,
    avgSpeedMetersPerSec: movingTimeSeconds > 0 ? distanceMeters / movingTimeSeconds : 0,
    maxSpeedMetersPerSec: maxSpd.length ? Math.max(...maxSpd) : 0,
    avgHeartrate: timeWeighted((x) => x.avgHeartrate),
    maxHeartrate: maxHr.length ? Math.max(...maxHr) : null,
    avgCadence: timeWeighted((x) => x.avgCadence),
    avgWatts: timeWeighted((x) => x.avgWatts),
    maxWatts: maxW.length ? Math.max(...maxW) : null,
    calories: cal.length ? sum(cal) : null,
    sufferScore: suf.length ? sum(suf) : null,
  };
}

interface ParsedCompanion {
  slug: string;
  data: Record<string, unknown>;
  content: string;
  ids: number[];
  usedIdsArray: boolean;
}

function parseCompanion(file: string): ParsedCompanion | null {
  try {
    const { data, content } = matter(fs.readFileSync(path.join(ADVENTURES_DIR, file), 'utf8'));
    const fm = data as Record<string, unknown>;
    return {
      slug: file.replace(/\.md$/, ''),
      data: fm,
      content,
      ids: parseStravaIds(fm),
      usedIdsArray: usesIdArray(fm),
    };
  } catch (err) {
    console.error(`[adventures] bad companion ${file}:`, err);
    return null;
  }
}

function buildAdventure(pc: ParsedCompanion): Adventure | null {
  const acts = pc.ids
    .map(readActivity)
    .filter((a): a is AdventureActivity => a != null);
  if (acts.length === 0) {
    console.warn(
      `[adventures] no snapshot for "${pc.slug}" (ids ${pc.ids.join(',') || 'none'}) — run npm run sync:strava`,
    );
    return null;
  }
  const common = mapCommonMetadata(pc.data, pc.slug);
  const primary = acts[0];
  const sportType: SportType = (str(pc.data.sport) as SportType | null) ?? primary.sportType;
  const tags = Array.isArray(pc.data.tags) ? (pc.data.tags as unknown[]).map(String) : [];
  const elevHigh = Math.max(...acts.map((a) => a.stats.elevHighMeters ?? Number.NEGATIVE_INFINITY));
  const peakClass = derivePeakClass(tags, str(pc.data.type), sportType, elevHigh);
  const date = pc.data.date != null ? normalizeDate(pc.data.date) : primary.date;
  const dayMeta = Array.isArray(pc.data.days)
    ? (pc.data.days as Array<{ title?: unknown; caption?: unknown }>)
    : [];

  const days: AdventureDay[] = acts.map((a, i) => ({
    dayIndex: i,
    title: str(dayMeta[i]?.title),
    caption: str(dayMeta[i]?.caption),
    activity: a,
    photos: resolvePhotos(a),
  }));
  const allPhotos = days.flatMap((d) => d.photos);

  let coverPhoto: ResolvedPhoto | null = null;
  const coverName = str(pc.data.cover_photo);
  if (coverName) {
    coverPhoto = allPhotos.find((p) => p.src.endsWith(coverName)) ?? null;
  }
  if (!coverPhoto) coverPhoto = allPhotos[0] ?? null;

  return {
    slug: pc.slug,
    title: common.title,
    date,
    sportType,
    isMultiDay: pc.usedIdsArray || acts.length > 1,
    // Same calendar day across all members → a multi-sport event (triathlon), shown as legs.
    isMultiSport: acts.length > 1 && acts.every((a) => a.date === primary.date),
    featured: common.featured,
    hidden: Boolean(pc.data.hidden),
    description: common.description,
    categories: common.categories,
    tags,
    type: str(pc.data.type),
    difficulty: str(pc.data.difficulty),
    grade: str(pc.data.grade),
    peakClass,
    rating: num(pc.data.rating),
    objective: str(pc.data.objective),
    coverPhoto,
    content: preprocessObsidian(pc.content, pc.slug),
    totals: computeTotals(acts),
    location: primary.location,
    days,
    allPhotos,
    primaryActivity: primary,
  };
}

function toSummary(adv: Adventure): AdventureSummary {
  return {
    slug: adv.slug,
    title: adv.title,
    date: adv.date,
    sportType: adv.sportType,
    isMultiDay: adv.isMultiDay,
    isMultiSport: adv.isMultiSport,
    featured: adv.featured,
    description: adv.description,
    type: adv.type,
    difficulty: adv.difficulty,
    peakClass: adv.peakClass,
    rating: adv.rating,
    tags: adv.tags,
    location: adv.location,
    coverThumb: adv.coverPhoto?.thumb ?? null,
    summaryPolyline: adv.primaryActivity.track?.summaryPolyline ?? null,
    // The sync writes route.jpg whenever the activity has a route, so the polyline's presence
    // tells us the thumbnail exists — without an fs check that would drag public/ into the
    // serverless trace (and blow past Vercel's function-size limit).
    routeThumb: adv.primaryActivity.track?.summaryPolyline
      ? `/adventures/${adv.primaryActivity.stravaId}/route.jpg`
      : null,
    dayCount: adv.days.length,
    totals: {
      distanceMeters: adv.totals.distanceMeters,
      elevationGainMeters: adv.totals.elevationGainMeters,
      movingTimeSeconds: adv.totals.movingTimeSeconds,
    },
  };
}

/** Build every visible (non-hidden) adventure. Internal — public APIs derive from this. */
function allAdventures(): Adventure[] {
  if (!fs.existsSync(ADVENTURES_DIR)) return [];
  const files = fs
    .readdirSync(ADVENTURES_DIR)
    .filter((f) => typeof f === 'string' && f.endsWith('.md') && f !== 'objectives.md' && !f.startsWith('.'));
  const out: Adventure[] = [];
  for (const f of files) {
    const pc = parseCompanion(f);
    if (!pc) continue;
    const adv = buildAdventure(pc);
    if (!adv || adv.hidden) continue;
    out.push(adv);
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getAllAdventures(): AdventureSummary[] {
  return allAdventures().map(toSummary);
}

export function getAdventureBySlug(slug: string): Adventure | null {
  const file = `${slug}.md`;
  if (!fs.existsSync(path.join(ADVENTURES_DIR, file))) return null;
  const pc = parseCompanion(file);
  if (!pc) return null;
  const adv = buildAdventure(pc);
  if (!adv || adv.hidden) return null;
  return adv;
}

export function getFeaturedAdventures(limit = 3): AdventureSummary[] {
  const all = getAllAdventures();
  const featured = all.filter((a) => a.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export function getLifetimeStats(): LifetimeStats {
  const advs = allAdventures();
  const bySport = new Map<SportType, SportTotals>();
  const states = new Set<string>();
  const countries = new Set<string>();
  let totalDistanceMeters = 0;
  let totalElevationGainMeters = 0;
  let longestDistance: Adventure | null = null;
  let mostVert: Adventure | null = null;
  let longestDuration: Adventure | null = null;
  let highestPoint: { meters: number; slug: string; title: string } | null = null;

  for (const a of advs) {
    totalDistanceMeters += a.totals.distanceMeters;
    totalElevationGainMeters += a.totals.elevationGainMeters;
    const e = bySport.get(a.sportType) ?? {
      sportType: a.sportType,
      count: 0,
      distanceMeters: 0,
      elevationGainMeters: 0,
    };
    e.count += 1;
    e.distanceMeters += a.totals.distanceMeters;
    e.elevationGainMeters += a.totals.elevationGainMeters;
    bySport.set(a.sportType, e);
    if (a.location.state) states.add(a.location.state);
    if (a.location.country) countries.add(a.location.country);
    if (!longestDistance || a.totals.distanceMeters > longestDistance.totals.distanceMeters) longestDistance = a;
    if (!mostVert || a.totals.elevationGainMeters > mostVert.totals.elevationGainMeters) mostVert = a;
    if (!longestDuration || a.totals.movingTimeSeconds > longestDuration.totals.movingTimeSeconds) longestDuration = a;
    const hi = Math.max(...a.days.map((d) => d.activity.stats.elevHighMeters ?? Number.NEGATIVE_INFINITY));
    if (Number.isFinite(hi) && (!highestPoint || hi > highestPoint.meters)) {
      highestPoint = { meters: hi, slug: a.slug, title: a.title };
    }
  }

  return {
    totalDistanceMeters,
    totalElevationGainMeters,
    adventureCount: advs.length,
    bySport: [...bySport.values()].sort((x, y) => y.distanceMeters - x.distanceMeters),
    states: [...states].sort(),
    countries: [...countries].sort(),
    records: {
      longestDistance: longestDistance ? toSummary(longestDistance) : null,
      mostVert: mostVert ? toSummary(mostVert) : null,
      longestDuration: longestDuration ? toSummary(longestDuration) : null,
      highestPoint,
    },
  };
}

export interface YearPoint {
  doy: number; // day of year, 1-366
  distM: number; // cumulative distance (meters) through that day
  gainM: number; // cumulative elevation gain (meters) through that day
}
export interface YearlyTotals {
  years: Record<string, YearPoint[]>;
}

/** Cumulative distance + elevation by day-of-year per year, across the full activity history. */
export function getYearlyTotals(): YearlyTotals {
  if (!fs.existsSync(YEARLY_FILE)) return { years: {} };
  try {
    return JSON.parse(fs.readFileSync(YEARLY_FILE, 'utf8')) as YearlyTotals;
  } catch (err) {
    console.error('[adventures] bad yearly-totals.json:', err);
    return { years: {} };
  }
}

/** All-time distance + elevation across the FULL activity history (not just published adventures). */
export function getActivityGrandTotals(): { distanceMeters: number; elevationGainMeters: number } {
  const { years } = getYearlyTotals();
  let distanceMeters = 0;
  let elevationGainMeters = 0;
  for (const pts of Object.values(years)) {
    const last = pts[pts.length - 1];
    if (last) {
      distanceMeters += last.distM;
      elevationGainMeters += last.gainM;
    }
  }
  return { distanceMeters, elevationGainMeters };
}

/** Slugs of objectives already fulfilled by a published report — by explicit `objective:` link or matching slug. */
function fulfilledObjectiveSlugs(): Set<string> {
  const done = new Set<string>();
  for (const a of allAdventures()) {
    done.add(a.slug);
    if (a.objective) done.add(a.objective);
  }
  return done;
}

/**
 * Objectives wishlist — only the still-to-do ones. An objective drops off once it's been done:
 * either its source note is marked complete, or a published report fulfills it (so the Colorado
 * Trail won't sit on the wishlist while its trip report exists).
 */
export function getObjectives(): ObjectivesData {
  if (!fs.existsSync(OBJECTIVES_FILE)) return { objectives: [] };
  try {
    const data = JSON.parse(fs.readFileSync(OBJECTIVES_FILE, 'utf8')) as { objectives?: Objective[] };
    const done = fulfilledObjectiveSlugs();
    const objectives = (data.objectives ?? []).filter(
      (o) => o.status !== 'completed' && o.status !== 'done' && !done.has(o.slug) && !o.completedSlug,
    );
    return { objectives };
  } catch (err) {
    console.error('[adventures] bad objectives.json:', err);
    return { objectives: [] };
  }
}
