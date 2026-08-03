/**
 * Read API for the Adventures section. Per-report reads use ONLY local files (committed snapshots
 * under data/adventures + report companions under content/adventures) — no Strava at build. The
 * all-time totals are read from the runtime store (Upstash Redis) at request time, falling back to
 * the gitignored local totals file (dev/CI) — see readLifetimeFile / getYearlyTotals.
 * Reuses lib/content.ts helpers; mirrors its catch-and-skip-malformed, date-desc posture.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { mapCommonMetadata, normalizeDate } from './content';
import { FACET_ORDER } from './facets';
import type { ObjectiveList } from './objective-lists';
import { preprocessObsidian } from '@blog/obsidian-md';
import type { AdventureActivity, AdventureStats, SportType } from '@blog/strava/types';
import { readTotals } from './strava-store';
import { parseStravaIds, usesIdArray, isRaceWorkoutType } from '@blog/strava';
import {
  isCompanionFile,
  derivePeakClass,
  isAdventureSport,
  type PeakClass,
  type AdventureSport,
} from './adventure-schema';

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
const OBJECTIVE_LISTS_FILE = path.join(SNAPSHOT_DIR, 'objective-lists.json');
const YEARLY_FILE = path.join(SNAPSHOT_DIR, 'yearly-totals.json');
const LIFETIME_FILE = path.join(SNAPSHOT_DIR, 'lifetime-totals.json');

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
// Canonical in adventure-schema (derived from PEAK_CLASSES); re-exported so components can keep
// importing it from here.
export type { PeakClass, AdventureSport } from './adventure-schema';

export interface Adventure {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  sportType: AdventureSport;
  isMultiDay: boolean;
  isMultiSport: boolean; // multiple activities on the SAME day (e.g. a triathlon) — legs, not days
  featured: boolean;
  hidden: boolean;
  description: string;
  categories: string[];
  tags: string[];
  type: string | null;
  difficulty: string | null;
  peakClass: PeakClass | null;
  facets: string[]; // filterable kinds: 14er/13er/race/couloir/scramble/traverse/thru-hike
  showHeartRate: boolean; // HR chart is opt-in (races); hidden by default
  laps: boolean; // a same-peak/route lap outing (Bear, Freeway, Eldora) — counts ascents, not peaks
  objective: string | null; // slug of fulfilled objective
  group: string | null; // shared key across repeat trips of the same route
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
  sportType: AdventureSport;
  sportTypes: SportType[]; // distinct sports across the legs (for multi-sport cards)
  isMultiDay: boolean;
  featured: boolean;
  description: string;
  type: string | null;
  difficulty: string | null;
  peakClass: PeakClass | null;
  facets: string[];
  tags: string[];
  location: { city: string | null; state: string | null; country: string | null };
  coverThumb: string | null;
  summaryPolyline: string | null; // primary leg, for the card's route shape
  routePolylines: string[]; // every leg, drawn separately on the library map
  routeThumb: string | null; // committed static map (basemap + route), if synced
  isMultiSport: boolean;
  dayCount: number;
  tripCount: number; // number of repeat trips of this route the card stands in for (1 if unique)
  lapCount: number; // total ascents across the trips, inferred from elevation (only for lap outings)
  isLaps: boolean; // true when this is a same-peak/route lap outing — gates the "N laps" badge
  totals: Pick<AdventureStats, 'distanceMeters' | 'elevationGainMeters' | 'movingTimeSeconds'>;
}

/** A sibling trip of the same route, for the trip-switcher tabs on a report. */
export interface TripRef {
  slug: string;
  title: string;
  date: string;
  hidden: boolean; // count-only member: totals include it, but the tab bar links only to visible trips
  totals: Pick<AdventureStats, 'distanceMeters' | 'elevationGainMeters' | 'movingTimeSeconds'>;
  laps: number; // lap count for this trip (1 for non-lap routes)
}

export interface SportTotals {
  sportType: AdventureSport;
  count: number;
  distanceMeters: number;
  elevationGainMeters: number;
  movingTimeSeconds: number;
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

/** `type` values that are themselves filterable facets (peakClass/race/duathlon come in separately). */
const TERRAIN_FACETS = new Set(['couloir', 'scramble', 'traverse', 'thru-hike']);

/** Filterable kinds an outing belongs to — derived purely from structured fields, no tags/title. */
function deriveFacets(
  type: string | null,
  peakClass: PeakClass | null,
  isRace: boolean,
  isDuathlon: boolean,
): string[] {
  const f = new Set<string>();
  if (peakClass) f.add(peakClass);
  if (isRace) f.add('race');
  if (isDuathlon) f.add('duathlon');
  if (type && TERRAIN_FACETS.has(type)) f.add(type);
  return FACET_ORDER.filter((k) => f.has(k));
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

/**
 * Race is derived from Strava's workout_type (Run 1 / Ride 11 = race). An explicit `race:` frontmatter
 * flag overrides it — used for multi-sport / ski-marathon races that workout_type can't express.
 */
export function deriveIsRace(
  frontmatterRace: unknown,
  activities: Pick<AdventureActivity, 'workoutType'>[],
): boolean {
  if (frontmatterRace !== undefined) return Boolean(frontmatterRace);
  return activities.some((a) => isRaceWorkoutType(a.workoutType));
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
  // An unrecognized `sport:` override would otherwise render as a bogus pill with the wrong
  // pace/speed label. adventure:validate rejects these in CI; this is the build-time backstop.
  const sportOverride = str(pc.data.sport);
  if (sportOverride != null && !isAdventureSport(sportOverride)) {
    console.warn(
      `[adventures] ${pc.slug}: unrecognized sport "${sportOverride}" — falling back to ${primary.sportType}`,
    );
  }
  const sportType: AdventureSport = isAdventureSport(sportOverride) ? sportOverride : primary.sportType;
  const tags = Array.isArray(pc.data.tags) ? (pc.data.tags as unknown[]).map(String) : [];
  const elevHigh = Math.max(...acts.map((a) => a.stats.elevHighMeters ?? Number.NEGATIVE_INFINITY));
  const typeStr = str(pc.data.type);
  const peakClass = derivePeakClass(str(pc.data.peakClass), typeStr, sportType, elevHigh);
  const isRace = deriveIsRace(pc.data.race, acts);
  const facets = deriveFacets(typeStr, peakClass, isRace, Boolean(pc.data.duathlon));
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
  if (coverName === 'none') {
    // Explicit opt-out (e.g. every photo is a selfie) — show the route thumbnail on the card instead.
    coverPhoto = null;
  } else {
    if (coverName) coverPhoto = allPhotos.find((p) => p.src.endsWith(coverName)) ?? null;
    if (!coverPhoto) coverPhoto = allPhotos[0] ?? null;
  }

  return {
    slug: pc.slug,
    // Title is editorial only when it differs from Strava — otherwise derive it from the snapshot.
    title: str(pc.data.title) ?? primary.name ?? pc.slug,
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
    peakClass,
    facets,
    showHeartRate: isRace,
    laps: Boolean(pc.data.laps),
    objective: str(pc.data.objective),
    group: str(pc.data.group),
    coverPhoto,
    content: preprocessObsidian(pc.content, pc.slug),
    totals: computeTotals(acts),
    location: primary.location,
    days,
    allPhotos,
    primaryActivity: primary,
  };
}

function toSummary(adv: Adventure, tripCount = 1, lapCount = 1): AdventureSummary {
  return {
    slug: adv.slug,
    title: adv.title,
    date: adv.date,
    sportType: adv.sportType,
    sportTypes: [...new Set(adv.days.map((d) => d.activity.sportType))],
    isMultiDay: adv.isMultiDay,
    isMultiSport: adv.isMultiSport,
    featured: adv.featured,
    description: adv.description,
    type: adv.type,
    difficulty: adv.difficulty,
    peakClass: adv.peakClass,
    facets: adv.facets,
    tags: adv.tags,
    location: adv.location,
    coverThumb: adv.coverPhoto?.thumb ?? null,
    summaryPolyline: adv.primaryActivity.track?.summaryPolyline ?? null,
    // Each member leg as its own polyline so the map draws them separately — a thru-hike shows its
    // whole route, and a link-up of two out-and-backs doesn't get a straight connector between them.
    routePolylines: adv.days
      .map((d) => d.activity.track?.summaryPolyline)
      .filter((p): p is string => Boolean(p)),
    // The sync writes route.jpg whenever the activity has a route, so the polyline's presence
    // tells us the thumbnail exists — without an fs check that would drag public/ into the
    // serverless trace (and blow past Vercel's function-size limit).
    routeThumb: adv.primaryActivity.track?.summaryPolyline
      ? `/adventures/${adv.primaryActivity.stravaId}/route.jpg`
      : null,
    dayCount: adv.days.length,
    tripCount,
    lapCount,
    isLaps: adv.laps,
    totals: {
      distanceMeters: adv.totals.distanceMeters,
      elevationGainMeters: adv.totals.elevationGainMeters,
      movingTimeSeconds: adv.totals.movingTimeSeconds,
    },
  };
}

/**
 * Build every adventure, INCLUDING hidden ones. Hidden reports are "count-only": they contribute to
 * their route's trip/lap totals (e.g. the many Eldora mornings that aren't individually written up)
 * but never get their own card or page. Internal.
 */
function allAdventuresIncludingHidden(): Adventure[] {
  if (!fs.existsSync(ADVENTURES_DIR)) return [];
  const files = fs.readdirSync(ADVENTURES_DIR).filter(isCompanionFile);
  const out: Adventure[] = [];
  for (const f of files) {
    const pc = parseCompanion(f);
    if (!pc) continue;
    const adv = buildAdventure(pc);
    if (!adv) continue;
    out.push(adv);
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Build every visible (non-hidden) adventure. Internal — public APIs derive from this. */
function allAdventures(): Adventure[] {
  return allAdventuresIncludingHidden().filter((a) => !a.hidden);
}

/** Repeat trips of the same route share a `group` key; ungrouped reports are their own group. */
function groupKey(a: Adventure): string {
  return a.group ?? a.slug;
}

/**
 * Count laps from the elevation profile: up-down cycles each clearing a real lap's worth of climb
 * (~400 ft), which ignores GPS noise. An "Eldora x4" uphill session reads as 4, a single summit as 1.
 * Only flagged lap routes reach this (see adventureLaps), so a multi-peak linkup or undulating
 * thru-hike — which would otherwise read as many laps — can't be miscounted here.
 */
function countLaps(altitude: number[]): number {
  if (altitude.length < 2) return altitude.length ? 1 : 0;
  const MIN = 120; // meters (~400 ft)
  let laps = 0;
  let climbed = 0;
  let descended = 0;
  let atTop = false;
  for (let i = 1; i < altitude.length; i++) {
    const d = altitude[i] - altitude[i - 1];
    if (d > 0) {
      climbed += d;
      descended = 0;
      if (climbed >= MIN) atTop = true;
    } else if (d < 0) {
      descended -= d;
      if (atTop && descended >= MIN) {
        laps++;
        atTop = false;
        climbed = 0;
      }
    }
  }
  if (atTop) laps++; // finished at the top of a qualifying climb (one-way summit)
  return Math.max(1, laps);
}

/**
 * Total laps across all of an outing's member activities. Laps only mean something for a same-peak
 * or same-route outing (Bear, Freeway, Eldora uphill), so non-lap outings always count as 1 — which
 * also keeps a multi-peak linkup or thru-hike from being miscounted, since only flagged routes reach
 * the elevation-cycle counter.
 */
function adventureLaps(a: Adventure): number {
  if (!a.laps) return 1;
  return a.days.reduce((s, d) => s + countLaps(d.activity.track?.altitude ?? []), 0);
}

/**
 * Library list — one card per route. Repeat trips collapse into a single representative (the most
 * recent, since `allAdventures` is date-desc) carrying a `tripCount`; sorting then uses that latest
 * date so a re-done route surfaces by its newest visit.
 */
export function getAllAdventures(): AdventureSummary[] {
  const byGroup = new Map<string, Adventure[]>();
  for (const a of allAdventuresIncludingHidden()) {
    const k = groupKey(a);
    const list = byGroup.get(k);
    if (list) list.push(a);
    else byGroup.set(k, [a]);
  }
  return [...byGroup.values()]
    .map((members) => {
      // Hidden members are count-only: they add to the trip/lap totals, but the card's representative
      // is always a real (visible) report, and a hidden-only group shows no card at all.
      const visible = members.filter((m) => !m.hidden);
      if (visible.length === 0) return null;
      const lapCount = members.reduce((s, m) => s + adventureLaps(m), 0);
      return toSummary(visible[0], members.length, lapCount);
    })
    .filter((s): s is AdventureSummary => s !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Every report slug (including non-representative repeat trips) — for generateStaticParams. */
export function getAllAdventureSlugs(): string[] {
  return allAdventures().map((a) => a.slug);
}

/** {slug, date} for every report (each trip is a real page) — for the sitemap. */
export function getAllAdventureRefs(): Array<{ slug: string; date: string }> {
  return allAdventures().map((a) => ({ slug: a.slug, date: a.date }));
}

/** Sibling trips of a route, most-recent first. Empty when the route was done only once. */
export function getAdventureTrips(slug: string): TripRef[] {
  const all = allAdventuresIncludingHidden();
  const target = all.find((a) => a.slug === slug);
  if (!target) return [];
  const key = groupKey(target);
  // Include hidden (count-only) members so the lap/session totals are complete; the tab bar skips them.
  const sibs = all.filter((a) => groupKey(a) === key);
  if (sibs.length <= 1) return [];
  return sibs.map((a) => ({
    slug: a.slug,
    title: a.title,
    date: a.date,
    hidden: a.hidden,
    totals: {
      distanceMeters: a.totals.distanceMeters,
      elevationGainMeters: a.totals.elevationGainMeters,
      movingTimeSeconds: a.totals.movingTimeSeconds,
    },
    laps: adventureLaps(a),
  }));
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

export interface YearSportTotals {
  [year: string]: {
    [sport: string]: { distanceMeters: number; elevationGainMeters: number; movingTimeSeconds: number };
  };
}

interface LifetimeFile {
  bySport: SportTotals[];
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalMovingTimeSeconds: number;
  byYearSport?: YearSportTotals;
  byMonthSport?: YearSportTotals; // keyed by YYYY-MM
}

/** Per-year, per-sport totals across the full human-powered history — for the composition chart. */
export async function getLifetimeByYearSport(): Promise<YearSportTotals> {
  return (await readLifetimeFile())?.byYearSport ?? {};
}

/** Per-month (YYYY-MM), per-sport volume — for the seasonal stacked-area chart. */
export async function getLifetimeByMonthSport(): Promise<YearSportTotals> {
  return (await readLifetimeFile())?.byMonthSport ?? {};
}

/** Full-history human-powered totals: the runtime store (Redis) in prod, else the gitignored local
 *  file (dev/CI), else null. No longer committed — see docs/strava-stats.md. */
async function readLifetimeFile(): Promise<LifetimeFile | null> {
  // Fall THROUGH to the local file rather than short-circuiting on hasStore(): with Redis
  // configured but unseeded, gating on hasStore() returned null and never tried the file.
  const t = await readTotals();
  if (t) return t.lifetime as unknown as LifetimeFile;
  // dev / fallback: the gitignored local file (populate with `npm run totals:refresh`)
  if (!fs.existsSync(LIFETIME_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LIFETIME_FILE, 'utf8')) as LifetimeFile;
  } catch (err) {
    console.error('[adventures] bad lifetime-totals.json:', err);
    return null;
  }
}

/**
 * Lifetime stats. Volume (by-sport totals, grand totals) reflects the FULL human-powered activity
 * history; the record chips and place lists come from the published reports (the only ones we can
 * link to). Falls back to published-only volume if the committed lifetime file is missing.
 */
export interface YearPoint {
  doy: number; // day of year, 1-366
  distM: number; // cumulative distance (meters) through that day
  gainM: number; // cumulative elevation gain (meters) through that day
  timeS: number; // cumulative moving time (seconds) through that day
}
export interface YearlyTotals {
  years: Record<string, YearPoint[]>;
}

/** Cumulative distance + elevation by day-of-year per year, across the full activity history. */
export async function getYearlyTotals(): Promise<YearlyTotals> {
  const t = await readTotals();
  if (t) return t.yearly as YearlyTotals;
  if (!fs.existsSync(YEARLY_FILE)) return { years: {} };
  try {
    return JSON.parse(fs.readFileSync(YEARLY_FILE, 'utf8')) as YearlyTotals;
  } catch (err) {
    console.error('[adventures] bad yearly-totals.json:', err);
    return { years: {} };
  }
}

/** All-time distance + elevation + time across the FULL activity history (not just published adventures). */
export async function getActivityGrandTotals(): Promise<{
  distanceMeters: number;
  elevationGainMeters: number;
  movingTimeSeconds: number;
}> {
  const { years } = await getYearlyTotals();
  let distanceMeters = 0;
  let elevationGainMeters = 0;
  let movingTimeSeconds = 0;
  for (const pts of Object.values(years)) {
    const last = pts[pts.length - 1];
    if (last) {
      distanceMeters += last.distM;
      elevationGainMeters += last.gainM;
      movingTimeSeconds += last.timeS ?? 0;
    }
  }
  return { distanceMeters, elevationGainMeters, movingTimeSeconds };
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

/**
 * Named objective checklists (14ers, Seven Summits, State High Points, Thru-Hikes, Bikepacks). Unlike
 * the wishlist, these are canonical fixed lists with per-item done/todo status — done items carry the
 * slug of the report that completed them. Read straight from the committed snapshot, order preserved.
 */
export function getObjectiveLists(): ObjectiveList[] {
  if (!fs.existsSync(OBJECTIVE_LISTS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(OBJECTIVE_LISTS_FILE, 'utf8')) as { lists?: ObjectiveList[] };
    return data.lists ?? [];
  } catch (err) {
    console.error('[adventures] bad objective-lists.json:', err);
    return [];
  }
}
