/**
 * Deterministic route attachment by GPS trailhead — the shared core behind `match-routes.ts` (batch
 * discovery of count-only repeats) and `adventure:new` (auto-attach a freshly-scaffolded activity to
 * an existing route). An activity belongs to a route if it starts within ~400 m of the route's median
 * trailhead AND shares the sport bucket — the only thing that separates, e.g., an Eldora morning from
 * an A-Basin day when both are named identically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ACTIVITIES_DIR, readCompanions, type Companion } from './strava-shared';

export const RADIUS_M = 400; // within this of the median trailhead = "the same start" (parking-lot scale)

// Sport buckets so a ski route only matches skis, a foot route only feet, etc.
export const BUCKET: Record<string, string> = {
  TrailRun: 'foot', Run: 'foot', Hike: 'foot', Walk: 'foot', Snowshoe: 'foot',
  Mountaineering: 'foot', RockClimbing: 'foot', Scramble: 'foot',
  Ride: 'bike', GravelRide: 'bike', MountainBikeRide: 'bike', EBikeRide: 'bike',
  BackcountrySki: 'ski', AlpineSki: 'ski', Snowboard: 'ski', NordicSki: 'nordic',
};
export const bucketOf = (sportType: string): string => BUCKET[sportType] ?? sportType;

export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface RouteGroup {
  key: string; // the `group:` value
  trailhead: [number, number]; // [lat, lng] median start across members
  buckets: Set<string>;
  laps: boolean;
}

export interface SnapStart {
  start: [number, number] | null;
  bucket: string | null;
}

/** A committed snapshot's start point ([lat, lng]; coordinates are stored [lng, lat]) and sport bucket. */
export function snapStartAndBucket(id: number): SnapStart {
  const p = path.join(ACTIVITIES_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return { start: null, bucket: null };
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const c = s.track?.coordinates?.[0];
    return { start: c ? [c[1], c[0]] : null, bucket: s.sportType ? bucketOf(String(s.sportType)) : null };
  } catch (err) {
    // Silently dropping this would make a route quietly fail to auto-attach with no signal.
    console.warn(
      `[route-match] unreadable snapshot ${id}.json — excluded from route matching:`,
      err instanceof Error ? err.message : err,
    );
    return { start: null, bucket: null };
  }
}

/** One companion's contribution to a route: which group it belongs to and which activities it covers. */
export interface RouteMember {
  group: string;
  laps: boolean;
  ids: number[];
}

/**
 * Pure core: collapse companions sharing a `group:` key into one trailhead signature each. Members
 * are merged by key, `laps` ORs across them, and a group whose members have no resolvable start
 * point is dropped. `snapOf` is injected so this is testable without the committed snapshots.
 */
export function groupRoutes(members: RouteMember[], snapOf: (id: number) => SnapStart = snapStartAndBucket): RouteGroup[] {
  const byGroup = new Map<string, { ids: number[]; laps: boolean }>();
  for (const m of members) {
    const g = byGroup.get(m.group) ?? { ids: [], laps: false };
    g.ids.push(...m.ids);
    if (m.laps) g.laps = true;
    byGroup.set(m.group, g);
  }
  const groups: RouteGroup[] = [];
  for (const [key, { ids, laps }] of byGroup) {
    const starts: Array<[number, number]> = [];
    const buckets = new Set<string>();
    for (const id of ids) {
      const { start, bucket } = snapOf(id);
      if (start) starts.push(start);
      if (bucket) buckets.add(bucket);
    }
    if (starts.length === 0) continue;
    groups.push({ key, trailhead: [median(starts.map((s) => s[0])), median(starts.map((s) => s[1]))], buckets, laps });
  }
  return groups;
}

/** Build a trailhead signature for every existing `group:` key from the committed snapshots. */
export function buildRouteGroups(): RouteGroup[] {
  const members = readCompanions()
    .filter((c): c is Companion & { group: string } => c.group != null)
    .map((c) => ({ group: c.group, laps: c.laps, ids: c.ids }));
  return groupRoutes(members);
}

/**
 * Find the existing route a start point + sport belongs to (nearest trailhead within RADIUS_M with a
 * matching sport bucket), or null. `sportType` is a mapped SportType (or the site-only `Scramble`).
 */
export function matchRoute(
  groups: RouteGroup[],
  startLat: number,
  startLng: number,
  sportType: string,
): { group: string; laps: boolean } | null {
  const bucket = bucketOf(sportType);
  let best: { group: string; laps: boolean; dist: number } | null = null;
  for (const g of groups) {
    if (!g.buckets.has(bucket)) continue;
    const d = haversine(g.trailhead[0], g.trailhead[1], startLat, startLng);
    if (d <= RADIUS_M && (!best || d < best.dist)) best = { group: g.key, laps: g.laps, dist: d };
  }
  return best ? { group: best.group, laps: best.laps } : null;
}
