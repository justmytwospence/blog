/**
 * Derive the committed lifetime + yearly totals from the all-activity index. Pure + deterministic:
 * the same index produces byte-identical JSON. Applies the human-powered filter (the one judgement
 * that matters for all-time stats). Runnable standalone (reads/writes the committed files) or
 * imported by the sync.
 *
 *   npx tsx scripts/build-totals.ts
 */
import fs from 'node:fs';
import { isHumanPowered, mapSportType, type AllActivityEntry } from '@blog/strava';
import { ALL_ACTIVITIES_FILE, LIFETIME_FILE, YEARLY_FILE } from './strava-shared';

interface SportAgg {
  distanceMeters: number;
  elevationGainMeters: number;
  movingTimeSeconds: number;
}
type YearSport = Record<string, Record<string, SportAgg>>;

function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

function bump(tree: YearSport, key: string, sport: string, e: AllActivityEntry): void {
  const byKey = (tree[key] ??= {});
  const slot = (byKey[sport] ??= { distanceMeters: 0, elevationGainMeters: 0, movingTimeSeconds: 0 });
  slot.distanceMeters += e.distanceMeters;
  slot.elevationGainMeters += e.elevationGainMeters;
  slot.movingTimeSeconds += e.movingTimeSeconds;
}

export function buildTotals(entries: AllActivityEntry[]) {
  const hp = entries.filter((e) => isHumanPowered(e) && e.date);

  const bySport = new Map<string, SportAgg & { count: number }>();
  const byYearSport: YearSport = {};
  const byMonthSport: YearSport = {};
  let totalDistanceMeters = 0;
  let totalElevationGainMeters = 0;
  let totalMovingTimeSeconds = 0;

  for (const e of hp) {
    const sport = mapSportType(e.sport);
    const cur = bySport.get(sport) ?? { count: 0, distanceMeters: 0, elevationGainMeters: 0, movingTimeSeconds: 0 };
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

  const lifetime = {
    totalDistanceMeters,
    totalElevationGainMeters,
    totalMovingTimeSeconds,
    activityCount: hp.length,
    bySport: [...bySport.entries()]
      .map(([sportType, v]) => ({ sportType, ...v }))
      .sort((a, b) => b.distanceMeters - a.distanceMeters),
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
  const years: Record<string, Array<{ doy: number; distM: number; gainM: number; timeS: number }>> = {};
  for (const [y, list] of byYear) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    let dist = 0;
    let gain = 0;
    let time = 0;
    const pts: Array<{ doy: number; distM: number; gainM: number; timeS: number }> = [];
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

export function writeTotals(entries: AllActivityEntry[]): void {
  const { lifetime, yearly } = buildTotals(entries);
  fs.writeFileSync(LIFETIME_FILE, `${JSON.stringify(lifetime, null, 2)}\n`);
  fs.writeFileSync(YEARLY_FILE, `${JSON.stringify(yearly, null, 2)}\n`);
  console.log(`[totals] ${entries.length} indexed → ${lifetime.activityCount} human-powered, ${lifetime.bySport.length} sports`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = JSON.parse(fs.readFileSync(ALL_ACTIVITIES_FILE, 'utf8')) as AllActivityEntry[];
  writeTotals(entries);
}
