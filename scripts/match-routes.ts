/**
 * Match unwhitelisted Strava activities to existing repeat routes by GPS trailhead, and scaffold
 * count-only (hidden) companion files so they feed the route's lap/trip totals — e.g. the daily
 * "Morning Backcountry Ski" sessions that are really Eldora laps but aren't each written up.
 *
 * Matching is by START POINT, not name: an activity belongs to a route if it starts within ~200 m of
 * the route's trailhead AND is the same sport mode. That's the only thing that separates an Eldora
 * morning from an A-Basin / Klondike / Utah backcountry day, which are all named identically.
 *
 * Run AFTER a reindex (needs data/adventures/all-activities.json with start coords):
 *   npx tsx scripts/match-routes.ts                 # dry-run: print matches, write nothing
 *   npx tsx scripts/match-routes.ts --route eldora-morning-uphill   # scope to one route
 *   npx tsx scripts/match-routes.ts --write         # scaffold the hidden count-only files
 * Then `npm run sync:strava` to fetch their snapshots and recount.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseStravaIds, mapSportType, type AllActivityEntry } from '@blog/strava';
import { CONTENT_DIR, ACTIVITIES_DIR, ALL_ACTIVITIES_FILE } from './strava-shared';
import { RADIUS_M, bucketOf, haversine, median } from './route-match';

const WRITE = process.argv.includes('--write');
const ROUTE = (() => {
  const i = process.argv.indexOf('--route');
  return i >= 0 ? process.argv[i + 1] : null;
})();

interface Companion { slug: string; group: string | null; laps: boolean; ids: number[] }
function readCompanions(): Companion[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'objectives.md' && !f.startsWith('.'))
    .map((f) => {
      const data = matter(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')).data;
      return { slug: f.replace(/\.md$/, ''), group: data.group ? String(data.group) : null, laps: Boolean(data.laps), ids: parseStravaIds(data) };
    });
}

/** A snapshot's start point as [lat, lng] (coordinates are stored [lng, lat]), and its sport bucket. */
function snapStartAndBucket(id: number): { start: [number, number] | null; bucket: string | null } {
  const p = path.join(ACTIVITIES_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return { start: null, bucket: null };
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const c = s.track?.coordinates?.[0];
  return { start: c ? [c[1], c[0]] : null, bucket: bucketOf(s.sportType) };
}

function main(): void {
  const idx: AllActivityEntry[] = fs.existsSync(ALL_ACTIVITIES_FILE)
    ? JSON.parse(fs.readFileSync(ALL_ACTIVITIES_FILE, 'utf8'))
    : [];
  if (idx.length === 0) {
    console.error('No data/adventures/all-activities.json — run `npm run sync:strava -- --reindex` first.');
    process.exit(1);
  }
  const comps = readCompanions();
  const whitelisted = new Set(comps.flatMap((c) => c.ids));

  const byGroup = new Map<string, Companion[]>();
  for (const c of comps) {
    const k = c.group ?? c.slug;
    (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(c);
  }

  let scaffolded = 0;
  for (const [key, members] of byGroup) {
    if (members.length < 2) continue; // only existing repeat routes
    if (ROUTE && key !== ROUTE) continue;
    const starts: Array<[number, number]> = [];
    const buckets = new Set<string>();
    for (const m of members) {
      for (const id of m.ids) {
        const { start, bucket } = snapStartAndBucket(id);
        if (start) starts.push(start);
        if (bucket) buckets.add(bucket);
      }
    }
    if (starts.length === 0) continue;
    const tLat = median(starts.map((s) => s[0]));
    const tLng = median(starts.map((s) => s[1]));
    const laps = members.some((m) => m.laps);

    const matches = idx
      .filter(
        (e) =>
          !whitelisted.has(e.id) &&
          e.startLat != null &&
          e.startLng != null &&
          buckets.has(bucketOf(mapSportType(e.sport))) &&
          haversine(tLat, tLng, e.startLat, e.startLng) <= RADIUS_M,
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (matches.length === 0) continue;

    console.log(`\n${key}  (trailhead ${tLat.toFixed(4)}, ${tLng.toFixed(4)}; ${[...buckets].join('/')}) — ${matches.length} new`);
    for (const m of matches) {
      console.log(`   ${m.date}  ${String(Math.round(m.elevationGainMeters * 3.28084)).padStart(5)}ft  ${m.name.slice(0, 44)}`);
      if (WRITE) {
        const lines = ['---', `group: ${key}`];
        if (laps) lines.push('laps: true');
        lines.push(`strava_id: ${m.id}`, 'hidden: true', '---', '');
        fs.writeFileSync(path.join(CONTENT_DIR, `${key}-${m.id}.md`), lines.join('\n'));
        scaffolded++;
      }
    }
  }
  console.log(
    WRITE
      ? `\nScaffolded ${scaffolded} count-only files. Now run \`npm run sync:strava\` to fetch their snapshots and recount.`
      : `\nDry run — re-run with --write to scaffold the hidden count-only files.`,
  );
}

main();
