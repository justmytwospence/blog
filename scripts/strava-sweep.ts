/**
 * Triage the FULL Strava history into a whitelist using a heuristic, so we don't hand-pick 1,700 activities.
 *
 * Keep an activity if any of:
 *   - distance >= half marathon (21.0975 km)
 *   - elevation gain >= 3,000 ft
 *   - it's a race (workout_type 1 = run race, 11 = ride race)
 *   - it's part of a multi-day trip (>= 3 near-consecutive days of the same effort)
 *   - it's "cool/notable" — has photos and a distinctive (non-everyday) name
 *
 *   npm run strava:sweep            # analyze + write .strava-sweep.json + print a summary
 *
 * Output (.strava-sweep.json, gitignored) feeds the bulk-scaffold step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { mintAccessToken, listActivities, type RawSummaryActivity } from '@blog/strava';
import { REPO_ROOT, getCreds, loadEnvLocal, readCompanions } from './strava-shared';
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
// Indoor / pure-training sports never count on their own (only if a race or genuinely notable).
const TRAINING_ONLY = new Set([
  'VirtualRide', 'EBikeRide', 'RollerSki', 'Velomobile', 'Workout', 'WeightTraining',
  'Yoga', 'Elliptical', 'StairStepper', 'Crossfit', 'Walk',
]);

/** Does this activity clear the sport-aware "this was an adventure" bar on its own? */
function clearsBar(a: Act): boolean {
  if (a.race) return true;
  if (TRAINING_ONLY.has(a.sport)) return false;
  if (FOOT.has(a.sport)) return a.distM >= HALF_MARATHON_M || a.gainM >= GAIN_3K_M;
  if (BIKE.has(a.sport)) return a.distM >= BIKE_LONG_M || a.gainM >= GAIN_3K_M;
  if (TOUR_SKI.has(a.sport)) return a.gainM >= GAIN_3K_M || a.distM >= SKI_LONG_M;
  // NordicSki, Swim, SUP, Kayak, etc.: only via race or the notable bucket.
  return false;
}

// Names that signal an everyday/non-adventure effort — excluded from the "notable" bucket.
const EVERYDAY = /\b(commute|treadmill|peloton|gym|lunch|morning|afternoon|evening|recovery|shakeout|easy|workout|tempo|intervals?|track|zwift|virtual|errand|dog walk|walk the dog|stretch|yoga|warm ?up|cool ?down)\b/i;
// Sports where a short outing can still be a genuine adventure.
const OUTDOORSY = new Set([
  'Hike', 'TrailRun', 'Walk', 'BackcountrySki', 'NordicSki', 'AlpineSki', 'Snowboard',
  'Snowshoe', 'RockClimbing', 'Mountaineering', 'Kayaking', 'Canoeing', 'StandUpPaddling',
  'Ride', 'GravelRide', 'MountainBikeRide', 'Swim',
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
  dayMs: number;
}

function toAct(a: RawSummaryActivity): Act {
  const sport = a.sport_type ?? a.type ?? 'Workout';
  const date = (a.start_date_local ?? '').slice(0, 10);
  return {
    id: a.id,
    name: a.name ?? '',
    sport,
    date,
    distM: a.distance ?? 0,
    gainM: a.total_elevation_gain ?? 0,
    photos: a.total_photo_count ?? 0,
    race: a.workout_type === 1 || a.workout_type === 11,
    dayMs: date ? new Date(`${date}T00:00:00Z`).getTime() : 0,
  };
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

  const singles: Act[] = [];
  const notableMaybe: Act[] = [];
  let skipped = 0;

  for (const a of acts) {
    if (published.has(a.id)) continue; // already has (or belongs to) a published report
    if (clearsBar(a)) {
      singles.push(a);
      continue;
    }
    const notable = a.photos > 0 && OUTDOORSY.has(a.sport) && !EVERYDAY.test(a.name);
    if (notable) notableMaybe.push(a);
    else skipped += 1;
  }

  const bySport = (list: Act[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const a of list) m[a.sport] = (m[a.sport] ?? 0) + 1;
    return m;
  };

  const slim = (a: Act) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    date: a.date,
    mi: +(a.distM / MI).toFixed(1),
    ft: Math.round(a.gainM * FT),
    photos: a.photos,
    race: a.race,
    published: published.has(a.id),
  });

  const result = {
    fetchedAt: new Date().toISOString(),
    totalActivities: acts.length,
    alreadyPublished: [...published],
    all: acts.sort((a, b) => b.dayMs - a.dayMs).map(slim),
    singles: singles
      .sort((a, b) => b.dayMs - a.dayMs)
      .map((a) => ({
        id: a.id,
        name: a.name,
        sport: a.sport,
        date: a.date,
        mi: +(a.distM / MI).toFixed(1),
        ft: Math.round(a.gainM * FT),
        photos: a.photos,
        race: a.race,
        published: published.has(a.id),
      })),
    notableMaybe: notableMaybe
      .sort((a, b) => b.photos - a.photos)
      .map((a) => ({
        id: a.id,
        name: a.name,
        sport: a.sport,
        date: a.date,
        mi: +(a.distM / MI).toFixed(1),
        ft: Math.round(a.gainM * FT),
        photos: a.photos,
        published: published.has(a.id),
      })),
    skipped,
  };

  fs.writeFileSync(SWEEP_FILE, JSON.stringify(result, null, 2));

  console.log(`\n[sweep] ${acts.length} activities total (${published.size} already published)`);
  console.log(`  single keepers:      ${result.singles.length}  (>= half marathon OR >= 3k ft OR race)  by sport:`, bySport(singles));
  console.log(`  notable maybes:      ${result.notableMaybe.length}  (photos, below thresholds)  by sport:`, bySport(notableMaybe));
  console.log(`  skipped (everyday):  ${result.skipped}`);
  console.log(`  races among keepers: ${singles.filter((s) => s.race).length}`);
  console.log(`\n  wrote ${path.relative(REPO_ROOT, SWEEP_FILE)} (includes full slim list for trip triage)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
