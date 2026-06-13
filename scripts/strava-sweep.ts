/**
 * Triage the FULL Strava history into a candidate pool for whitelisting, so we don't hand-pick 1,700 activities.
 *
 * Deterministic excludes (never adventures): indoor/trainer rides, treadmill, commutes, pool swims,
 * gym/yoga/strength. Then a sport-aware "plausibly notable" filter builds a candidate pool that a
 * judgment pass reasons over (cool vs routine, in context). Same-day swim+bike+run clusters are
 * flagged as possible triathlons to combine into one report.
 *
 *   npm run strava:sweep            # analyze + write .strava-sweep.json + print a summary
 *
 * Output (.strava-sweep.json, gitignored) feeds the judgment workflow and bulk-scaffold step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { mintAccessToken, listActivities, type RawSummaryActivity } from '@blog/strava';
import { REPO_ROOT, DATA_DIR, getCreds, loadEnvLocal, readCompanions } from './strava-shared';
import matter from 'gray-matter';

const HALF_MARATHON_M = 21_097.5;
const GAIN_3K_M = 3000 / 3.280839895; // 3,000 ft
const BIKE_LONG_M = 40 * 1609.344; // 40 mi — a half marathon is trivial on a bike, so the ride bar is higher
const SKI_LONG_M = 10 * 1609.344; // 10 mi — a meaningful ski tour
const MI = 1609.344;
const FT = 3.280839895;
const SWEEP_FILE = path.join(REPO_ROOT, '.strava-sweep.json');

// Sport buckets for sport-aware thresholds.
const FOOT = new Set(['Run', 'TrailRun', 'Hike', 'Snowshoe', 'Mountaineering', 'RockClimbing']);
const BIKE = new Set(['Ride', 'GravelRide', 'MountainBikeRide']);
const TOUR_SKI = new Set(['BackcountrySki', 'AlpineSki']);
const RUN_SPORTS = new Set(['Run', 'TrailRun']);
// Sports that are inherently indoor / pure-training — never an adventure.
const INDOOR_SPORT = new Set([
  'VirtualRide', 'EBikeRide', 'Velomobile', 'VirtualRun', 'VirtualRow', 'Workout',
  'WeightTraining', 'Yoga', 'Elliptical', 'StairStepper', 'Crossfit', 'Pilates',
]);
// Sports where even a short outing can be a genuine adventure (for the photo/notable signal).
const OUTDOORSY = new Set([
  'Hike', 'TrailRun', 'Walk', 'BackcountrySki', 'NordicSki', 'AlpineSki', 'Snowboard',
  'Snowshoe', 'RockClimbing', 'Mountaineering', 'Kayaking', 'Canoeing', 'StandUpPaddling',
  'Ride', 'GravelRide', 'MountainBikeRide', 'Swim', 'Surfing',
]);

interface Act {
  id: number;
  name: string;
  sport: string;
  date: string; // YYYY-MM-DD
  distM: number;
  gainM: number;
  photos: number;
  race: boolean;
  trainer: boolean;
  commute: boolean;
  poolSwim: boolean;
  hasGps: boolean;
  minutes: number;
  dayMs: number;
}

function toAct(a: RawSummaryActivity): Act {
  const sport = a.sport_type ?? a.type ?? 'Workout';
  const date = (a.start_date_local ?? '').slice(0, 10);
  const hasGps = Boolean(a.map?.summary_polyline && a.map.summary_polyline.length > 0);
  return {
    id: a.id,
    name: a.name ?? '',
    sport,
    date,
    distM: a.distance ?? 0,
    gainM: a.total_elevation_gain ?? 0,
    photos: a.total_photo_count ?? 0,
    race: a.workout_type === 1 || a.workout_type === 11,
    trainer: Boolean(a.trainer),
    commute: Boolean(a.commute),
    poolSwim: sport === 'Swim' && (Boolean(a.pool_length && a.pool_length > 0) || !hasGps),
    hasGps,
    minutes: Math.round((a.moving_time ?? 0) / 60),
    dayMs: date ? new Date(`${date}T00:00:00Z`).getTime() : 0,
  };
}

/** Deterministic "never an adventure" reason, or null. */
function autoExcludeReason(a: Act): string | null {
  if (a.trainer) return 'trainer';
  if (a.commute) return 'commute';
  if (INDOOR_SPORT.has(a.sport)) return 'indoor';
  if (a.poolSwim) return 'pool-swim';
  return null;
}

/** Plausibly worth a human/agent look: cleared a real bar, was photographed, or was a race. */
function clearsBar(a: Act): boolean {
  if (a.race) return true;
  if (FOOT.has(a.sport)) return a.distM >= HALF_MARATHON_M || a.gainM >= GAIN_3K_M;
  if (BIKE.has(a.sport)) return a.distM >= BIKE_LONG_M || a.gainM >= GAIN_3K_M;
  if (TOUR_SKI.has(a.sport)) return a.gainM >= GAIN_3K_M || a.distM >= SKI_LONG_M;
  return false;
}

/** Same calendar day containing a swim + a bike + a run = a likely triathlon/brick to combine. */
function detectTriathlons(acts: Act[], excluded: Set<number>): Act[][] {
  const byDate = new Map<string, Act[]>();
  for (const a of acts) {
    if (!a.date || excluded.has(a.id)) continue;
    (byDate.get(a.date) ?? byDate.set(a.date, []).get(a.date)!).push(a);
  }
  const tris: Act[][] = [];
  for (const [, day] of byDate) {
    const swim = day.find((a) => a.sport === 'Swim');
    const bike = day.find((a) => BIKE.has(a.sport));
    const run = day.find((a) => RUN_SPORTS.has(a.sport));
    if (swim && bike && run) {
      // order swim → bike → run
      tris.push([swim, bike, run].filter(Boolean) as Act[]);
    }
  }
  return tris.sort((a, b) => b[0].dayMs - a[0].dayMs);
}

/** 1-based day of the year for a YYYY-MM-DD date. */
function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const start = Date.UTC(y, 0, 0);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000);
}

/**
 * Cumulative distance + elevation by day-of-year for every year, across ALL activities
 * (the whole training volume, not just the whitelist). Committed for the year-over-year chart.
 */
function writeYearlyTotals(acts: Act[]): { years: number; points: number } {
  const byYear = new Map<string, Act[]>();
  for (const a of acts) {
    if (!a.date) continue;
    const y = a.date.slice(0, 4);
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(a);
  }
  const years: Record<string, Array<{ doy: number; distM: number; gainM: number }>> = {};
  let points = 0;
  for (const [y, list] of byYear) {
    list.sort((a, b) => a.dayMs - b.dayMs);
    let dist = 0;
    let gain = 0;
    const pts: Array<{ doy: number; distM: number; gainM: number }> = [];
    for (const a of list) {
      dist += a.distM;
      gain += a.gainM;
      const doy = dayOfYear(a.date);
      const last = pts[pts.length - 1];
      if (last && last.doy === doy) {
        last.distM = Math.round(dist);
        last.gainM = Math.round(gain);
      } else {
        pts.push({ doy, distM: Math.round(dist), gainM: Math.round(gain) });
      }
    }
    years[y] = pts;
    points += pts.length;
  }
  fs.writeFileSync(path.join(DATA_DIR, 'yearly-totals.json'), JSON.stringify({ years }));
  return { years: byYear.size, points };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const token = await mintAccessToken(getCreds());

  const published = new Set<number>();
  for (const c of readCompanions((s) => matter(s))) c.ids.forEach((id) => published.add(id));

  const raw: RawSummaryActivity[] = [];
  for (let page = 1; page <= 50; page++) {
    const chunk = await listActivities(token.accessToken, { page, perPage: 200 });
    raw.push(...chunk);
    process.stdout.write(`\r[sweep] fetched ${raw.length} activities...`);
    if (chunk.length < 200) break;
  }
  process.stdout.write('\n');

  const acts = raw.map(toAct);
  const excludedIds = new Set<number>();
  const autoExcluded: Record<string, number> = {};
  for (const a of acts) {
    const reason = autoExcludeReason(a);
    if (reason) {
      excludedIds.add(a.id);
      autoExcluded[reason] = (autoExcluded[reason] ?? 0) + 1;
    }
  }

  const triathlons = detectTriathlons(acts, excludedIds);
  const triIds = new Set<number>(triathlons.flatMap((t) => t.map((a) => a.id)));

  // Candidate pool for the judgment pass: survived deterministic excludes, not published,
  // not a triathlon leg, and is plausibly notable (cleared a bar OR photographed OR a race).
  const candidates: Act[] = [];
  for (const a of acts) {
    if (published.has(a.id) || excludedIds.has(a.id) || triIds.has(a.id)) continue;
    const plausible = clearsBar(a) || (a.photos > 0 && OUTDOORSY.has(a.sport));
    if (plausible) candidates.push(a);
  }

  const slim = (a: Act) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    date: a.date,
    mi: +(a.distM / MI).toFixed(1),
    ft: Math.round(a.gainM * FT),
    minutes: a.minutes,
    photos: a.photos,
    race: a.race,
    hasGps: a.hasGps,
    clearedBar: clearsBar(a),
  });

  const bySport = (list: Act[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const a of list) m[a.sport] = (m[a.sport] ?? 0) + 1;
    return m;
  };

  const result = {
    fetchedAt: new Date().toISOString(),
    totalActivities: acts.length,
    alreadyPublished: [...published],
    autoExcluded,
    triathlons: triathlons.map((t) => ({
      date: t[0].date,
      legs: t.map(slim),
      ids: t.map((a) => a.id),
    })),
    candidates: candidates.sort((a, b) => b.dayMs - a.dayMs).map(slim),
    all: acts.sort((a, b) => b.dayMs - a.dayMs).map(slim),
  };

  fs.writeFileSync(SWEEP_FILE, JSON.stringify(result, null, 2));
  const yearly = writeYearlyTotals(acts);

  console.log(`\n[sweep] ${acts.length} activities (${published.size} already published)`);
  console.log(`  yearly-totals.json: ${yearly.years} years, ${yearly.points} cumulative points`);
  console.log(`  auto-excluded:`, autoExcluded);
  console.log(`  triathlons (same-day S+B+R): ${triathlons.length}`);
  for (const t of triathlons) console.log(`    ${t[0].date}: ${t.map((a) => `${a.sport} "${a.name}"`).join('  +  ')}`);
  console.log(`  candidate pool for judgment: ${candidates.length}  by sport:`, bySport(candidates));
  console.log(`\n  wrote ${path.relative(REPO_ROOT, SWEEP_FILE)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
