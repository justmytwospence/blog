/**
 * Discover recent Strava activities and scaffold report stubs — so you never hand-copy ids.
 *
 *   npm run strava:inbox                      # list recent activities (marks already-published)
 *   npm run strava:inbox -- --scaffold <id>   # write a stub content/adventures/<slug>.md
 *   npm run strava:inbox -- --scaffold a,b,c  # multi-day stub (strava_ids in day order)
 *   npm run strava:inbox -- --pages 3         # list more (default 2 pages of 50)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  mintAccessToken,
  listActivities,
  getActivityDetail,
  mapSportType,
  type RawSummaryActivity,
} from '@blog/strava';
import { CONTENT_DIR, getCreds, loadEnvLocal, readCompanions, slugify } from './strava-shared';
import matter from 'gray-matter';

const MI = 1609.344;
const FT = 3.280839895;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function publishedIds(): Set<number> {
  const set = new Set<number>();
  for (const c of readCompanions((s) => matter(s))) c.ids.forEach((id) => set.add(id));
  return set;
}

function uniqueSlug(base: string): string {
  let slug = base;
  let n = 2;
  while (fs.existsSync(path.join(CONTENT_DIR, `${slug}.md`))) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function scaffold(access: string, idsCsv: string): Promise<void> {
  const ids = idsCsv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));
  if (ids.length === 0) {
    console.error('No valid ids passed to --scaffold');
    process.exit(1);
  }
  const details = [];
  for (const id of ids) {
    const d = await getActivityDetail(access, id);
    if (!d) {
      console.error(`Could not fetch activity ${id}`);
      process.exit(1);
    }
    details.push(d);
  }
  const first = details[0];
  const slug = uniqueSlug(slugify(first.name || `activity-${first.id}`));
  const date = (first.start_date_local ?? '').slice(0, 10);
  const sport = mapSportType(first.sport_type ?? first.type);
  const multi = ids.length > 1;

  const lines = ['---', `title: "${(first.name || '').replace(/"/g, '\\"')}"`];
  if (multi) lines.push(`strava_ids: [${ids.join(', ')}]`);
  else lines.push(`strava_id: ${ids[0]}`);
  lines.push(`date: ${date}`, `sport: ${sport}`, 'difficulty:', 'rating:', 'type:', 'tags: []', 'featured: false', 'hidden: true');
  if (multi) {
    lines.push('days:');
    for (const d of details) {
      lines.push(`  - title: "${(d.name || '').replace(/"/g, '\\"')}"`);
      lines.push('    caption:');
    }
  }
  lines.push('---', '', '<!-- Write your trip report here. Run `npm run sync:strava` to pull stats, map, photos. -->', '');

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  fs.writeFileSync(file, lines.join('\n'));
  console.log(`Scaffolded ${path.relative(process.cwd(), file)} (hidden: true). Edit it, then run npm run sync:strava.`);
}

function printTable(acts: RawSummaryActivity[], published: Set<number>): void {
  console.log('PUB DATE        SPORT             NAME                                    DIST    GAIN   PH   ID');
  for (const a of acts) {
    const pub = published.has(a.id) ? ' ✓ ' : '   ';
    const date = (a.start_date_local ?? '').slice(0, 10);
    const sport = (a.sport_type ?? a.type ?? '').padEnd(17).slice(0, 17);
    const name = (a.name ?? '').padEnd(38).slice(0, 38);
    const dist = `${(a.distance / MI).toFixed(1)}mi`.padStart(7);
    const gain = `${Math.round(a.total_elevation_gain * FT)}ft`.padStart(7);
    const ph = String(a.total_photo_count ?? 0).padStart(2);
    console.log(`${pub} ${date}  ${sport} ${name} ${dist} ${gain}  ${ph}  ${a.id}`);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const token = await mintAccessToken(getCreds());

  const scaffoldIds = argValue('--scaffold');
  if (scaffoldIds) {
    await scaffold(token.accessToken, scaffoldIds);
    return;
  }

  const pages = Number(argValue('--pages') ?? 2);
  const published = publishedIds();
  const all: RawSummaryActivity[] = [];
  for (let page = 1; page <= pages; page++) {
    const chunk = await listActivities(token.accessToken, { page, perPage: 50 });
    all.push(...chunk);
    if (chunk.length < 50) break;
  }
  printTable(all, published);
  console.log(`\n${all.length} activities. Scaffold one with:  npm run strava:inbox -- --scaffold <id>`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
