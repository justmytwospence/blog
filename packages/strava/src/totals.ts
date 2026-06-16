/**
 * Derive lifetime + yearly totals from the all-activity index. Pure + deterministic: the same
 * index produces byte-identical output. Applies the human-powered filter (the one judgement that
 * matters for all-time stats). No fs/network — safe to import at runtime (route / server component).
 */
import { isHumanPowered } from './classify';
import { mapSportType } from './transform';
import type { AllActivityEntry } from './types';

interface SportAgg {
  distanceMeters: number;
  elevationGainMeters: number;
  movingTimeSeconds: number;
}
/** Per-year (or per-month) → per-sport aggregates. */
export type YearSportTree = Record<string, Record<string, SportAgg>>;
export interface SportTotal extends SportAgg {
  sportType: string;
  count: number;
}
export interface LifetimeTotals {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalMovingTimeSeconds: number;
  activityCount: number;
  bySport: SportTotal[];
  byYearSport: YearSportTree;
  byMonthSport: YearSportTree;
}
export interface YearPoint {
  doy: number;
  distM: number;
  gainM: number;
  timeS: number;
}
export interface YearlyTotals {
  years: Record<string, YearPoint[]>;
}
export interface StravaTotals {
  lifetime: LifetimeTotals;
  yearly: YearlyTotals;
}

function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

function bump(tree: YearSportTree, key: string, sport: string, e: AllActivityEntry): void {
  const byKey = (tree[key] ??= {});
  const slot = (byKey[sport] ??= { distanceMeters: 0, elevationGainMeters: 0, movingTimeSeconds: 0 });
  slot.distanceMeters += e.distanceMeters;
  slot.elevationGainMeters += e.elevationGainMeters;
  slot.movingTimeSeconds += e.movingTimeSeconds;
}

export function buildTotals(entries: AllActivityEntry[]): StravaTotals {
  const hp = entries.filter((e) => isHumanPowered(e) && e.date);

  const bySport = new Map<string, SportTotal>();
  const byYearSport: YearSportTree = {};
  const byMonthSport: YearSportTree = {};
  let totalDistanceMeters = 0;
  let totalElevationGainMeters = 0;
  let totalMovingTimeSeconds = 0;

  for (const e of hp) {
    const sport = mapSportType(e.sport);
    const cur = bySport.get(sport) ?? { sportType: sport, count: 0, distanceMeters: 0, elevationGainMeters: 0, movingTimeSeconds: 0 };
    cur.count += 1;
    cur.distanceMeters += e.distanceMeters;
    cur.elevationGainMeters += e.elevationGainMeters;
    cur.movingTimeSeconds += e.movingTimeSeconds;
    bySport.set(sport, cur);
    bump(byYearSport, e.date.slice(0, 4), sport, e);
    bump(byMonthSport, e.date.slice(0, 7), sport, e);
    totalDistanceMeters += e.distanceMeters;
    totalElevationGainMeters += e.elevationGainMeters;
    totalMovingTimeSeconds += e.movingTimeSeconds;
  }

  const lifetime: LifetimeTotals = {
    totalDistanceMeters,
    totalElevationGainMeters,
    totalMovingTimeSeconds,
    activityCount: hp.length,
    bySport: [...bySport.values()].sort((a, b) => b.distanceMeters - a.distanceMeters),
    byYearSport,
    byMonthSport,
  };

  // Cumulative distance/gain/time by day-of-year, per year (human-powered only).
  const byYear = new Map<string, AllActivityEntry[]>();
  for (const e of hp) {
    const y = e.date.slice(0, 4);
    const list = byYear.get(y);
    if (list) list.push(e);
    else byYear.set(y, [e]);
  }
  const years: Record<string, YearPoint[]> = {};
  for (const [y, list] of byYear) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    let dist = 0;
    let gain = 0;
    let time = 0;
    const pts: YearPoint[] = [];
    for (const e of list) {
      dist += e.distanceMeters;
      gain += e.elevationGainMeters;
      time += e.movingTimeSeconds;
      const doy = dayOfYear(e.date);
      const last = pts[pts.length - 1];
      if (last && last.doy === doy) {
        last.distM = Math.round(dist);
        last.gainM = Math.round(gain);
        last.timeS = Math.round(time);
      } else {
        pts.push({ doy, distM: Math.round(dist), gainM: Math.round(gain), timeS: Math.round(time) });
      }
    }
    years[y] = pts;
  }

  return { lifetime, yearly: { years } };
}
