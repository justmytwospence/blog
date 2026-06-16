/**
 * Scaffold a companion trip-report for a Strava activity:
 *
 *   npm run adventure:new -- <stravaId> [options]
 *
 * Options (all optional — anything omitted is left as a commented hint to fill in by hand):
 *   --slug <slug>        filename slug (default: slugified Strava activity name)
 *   --title <title>      displayed title override (default: the Strava activity name)
 *   --type <type>        peak | scramble | traverse | couloir | thru-hike | mountaineering
 *   --sport <sport>      sport override (e.g. Scramble, Hike); default uses Strava's sport
 *   --tags a,b,c         comma-separated category tags
 *   --difficulty <d>     moderate | hard | epic
 *   --group <group>      collapse repeat trips of the same route under one card
 *   --race               flag as a race
 *   --duathlon           flag as a duathlon
 *   --hidden             create hidden (default: visible)
 *
 * Fetches the activity summary and writes content/adventures/<slug>.md, then validates it.
 * Does NOT fetch the full snapshot — run `npm run sync:strava` afterwards to pull maps/photos/stats.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { mintAccessToken, getActivityDetail, mapSportType } from '@blog/strava';
import {
  loadEnvLocal,
  getCreds,
  persistRefreshToken,
  slugify,
  CONTENT_DIR,
  readCompanions,
} from './strava-shared';
import { validateCompanionFrontmatter, ADVENTURE_TYPES, DIFFICULTIES } from '../lib/adventure-schema';

interface Args {
  id: number;
  slug?: string;
  title?: string;
  type?: string;
  sport?: string;
  tags?: string[];
  difficulty?: string;
  group?: string;
  race: boolean;
  duathlon: boolean;
  hidden: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { id: NaN, race: false, duathlon: false, hidden: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    const next = () => rest[++i];
    switch (t) {
      case '--slug': a.slug = next(); break;
      case '--title': a.title = next(); break;
      case '--type': a.type = next(); break;
      case '--sport': a.sport = next(); break;
      case '--tags': a.tags = (next() ?? '').split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--difficulty': a.difficulty = next(); break;
      case '--group': a.group = next(); break;
      case '--race': a.race = true; break;
      case '--duathlon': a.duathlon = true; break;
      case '--hidden': a.hidden = true; break;
      default:
        if (/^\d+$/.test(t) && Number.isNaN(a.id)) a.id = Number(t);
        else { console.error(`[adventure:new] unexpected argument: ${t}`); process.exit(1); }
    }
  }
  return a;
}

/** YAML-safe scalar (double-quote strings; pass numbers/bools through). */
function yaml(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (Number.isNaN(args.id)) {
    console.error('Usage: npm run adventure:new -- <stravaId> [--type peak --tags a,b --title "..."]');
    process.exit(1);
  }
  if (args.type && !(ADVENTURE_TYPES as readonly string[]).includes(args.type)) {
    console.error(`[adventure:new] --type must be one of: ${ADVENTURE_TYPES.join(', ')}`);
    process.exit(1);
  }
  if (args.difficulty && !(DIFFICULTIES as readonly string[]).includes(args.difficulty)) {
    console.error(`[adventure:new] --difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
    process.exit(1);
  }

  // Fail fast if the id is already whitelisted by an existing companion.
  const companions = readCompanions((s) => matter(s));
  const dupe = companions.find((c) => c.ids.includes(args.id));
  if (dupe) {
    console.error(`[adventure:new] Strava id ${args.id} is already referenced by ${dupe.file}`);
    process.exit(1);
  }

  loadEnvLocal();
  const token = await mintAccessToken(getCreds());
  if (token.rotated) persistRefreshToken(token.refreshToken);

  const detail = await getActivityDetail(token.accessToken, args.id);
  if (!detail) {
    console.error(`[adventure:new] Strava returned no activity for id ${args.id} (private, or wrong id?)`);
    process.exit(1);
  }

  const slug = slugify(args.slug ?? detail.name);
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (fs.existsSync(file)) {
    console.error(`[adventure:new] content/adventures/${slug}.md already exists — pass --slug to choose another name`);
    process.exit(1);
  }

  const sportGuess = mapSportType(detail.sport_type);
  const km = (detail.distance / 1000).toFixed(1);
  const gain = Math.round(detail.total_elevation_gain);
  const date = detail.start_date_local.slice(0, 10);

  const lines: string[] = [];
  lines.push(`# ${detail.name} — ${date} · ${km} km · ${gain} m gain · ${sportGuess}`);
  lines.push('# Scaffolded by `npm run adventure:new`. Fill in the editorial fields, then `npm run sync:strava`.');
  lines.push(`strava_id: ${args.id}`);
  lines.push(`hidden: ${args.hidden}`);
  if (args.title) lines.push(`title: ${yaml(args.title)}`);
  lines.push(args.type ? `type: ${args.type}` : `# type: peak            # ${ADVENTURE_TYPES.join(' | ')}`);
  lines.push(args.sport ? `sport: ${args.sport}` : `# sport: ${sportGuess}        # override Strava's sport (e.g. Scramble, Hike)`);
  if (args.tags?.length) lines.push(`tags: [${args.tags.map(yaml).join(', ')}]`);
  else lines.push('# tags: [colorado, 14er]');
  lines.push(args.difficulty ? `difficulty: ${args.difficulty}` : `# difficulty: hard      # ${DIFFICULTIES.join(' | ')}`);
  if (args.group) lines.push(`group: ${yaml(args.group)}`);
  else lines.push('# group: route-key      # collapse repeat trips of the same route');
  if (args.race) lines.push('race: true');
  if (args.duathlon) lines.push('duathlon: true');

  const md = `---\n${lines.join('\n')}\n---\n`;
  fs.writeFileSync(file, md);

  const errs = validateCompanionFrontmatter(matter(md).data as Record<string, unknown>, `${slug}.md`);
  if (errs.length) {
    console.error('[adventure:new] scaffold failed validation:');
    for (const e of errs) console.error('  ✗ ' + e);
    process.exit(1);
  }

  console.log(`[adventure:new] ✓ wrote content/adventures/${slug}.md`);
  console.log(`    ${detail.name} — ${date} · ${km} km · ${gain} m gain`);
  console.log('\nNext:');
  console.log(`  1. edit content/adventures/${slug}.md (fill type / tags / title as desired)`);
  console.log('  2. npm run sync:strava         # fetch maps, photos, stats for this activity');
  console.log('  3. npm run adventure:validate  # confirm it is well-formed');
}

main().catch((err) => {
  console.error('[adventure:new]', err);
  process.exit(1);
});
