/**
 * Scaffold a companion trip-report for a Strava activity:
 *
 *   npm run adventure:new -- <stravaId> [options]
 *
 * Only the EDITORIAL fields need a human. sport / title / date / race (Run/Ride) / peakClass are
 * DERIVED by the pipeline from the Strava snapshot; group + laps auto-attach by GPS trailhead when the
 * activity matches a known route. Set the flags below only to override a derived value.
 *
 * Options (all optional — anything omitted is left as a commented hint or derived):
 *   --slug <slug>        filename slug (default: slugified Strava activity name)
 *   --type <type>        peak | scramble | traverse | couloir | thru-hike | mountaineering (EDITORIAL)
 *   --tags a,b,c         comma-separated range/place tokens (EDITORIAL)
 *   --difficulty <d>     moderate | hard | epic (EDITORIAL)
 *   --title <title>      title override (default: derived from the Strava name)
 *   --sport <sport>      sport override, e.g. Scramble / Mountaineering (default: derived)
 *   --group <group>      route key override (default: auto-attached by GPS when known)
 *   --race               flag a race workout_type can't express (triathlon, ski marathon)
 *   --duathlon           flag as a duathlon
 *   --hidden             create hidden count-only (default: visible)
 *
 * Fetches the activity summary and writes content/adventures/<slug>.md, then validates it. Does NOT
 * fetch the full snapshot — run `npm run sync:strava -- --only <id>` afterwards to pull maps/photos/stats.
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
import { buildRouteGroups, matchRoute } from './route-match';

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

  // Deterministic route attachment: if this activity starts at a known route's trailhead, inherit its
  // group + laps by GPS — no need for the human/agent to hunt down the group key.
  let group = args.group;
  let laps = false;
  if (!group && Array.isArray(detail.start_latlng) && detail.start_latlng.length === 2) {
    const m = matchRoute(buildRouteGroups(), detail.start_latlng[0], detail.start_latlng[1], sportGuess);
    if (m) {
      group = m.group;
      laps = m.laps;
      console.log(`[adventure:new] auto-attached to route "${m.group}"${m.laps ? ' (laps)' : ''} by GPS trailhead`);
    }
  }

  const lines: string[] = [];
  lines.push(`# ${detail.name} — ${date} · ${km} km · ${gain} m gain · ${sportGuess}`);
  lines.push('# Scaffolded by `npm run adventure:new`. Fill the EDITORIAL fields, then `npm run sync:strava -- --only <id>`.');
  lines.push('# Derived automatically — set only to OVERRIDE: sport, title, date, race (Run/Ride), peakClass.');
  lines.push(`strava_id: ${args.id}`);
  if (args.hidden) lines.push('hidden: true');
  if (args.title) lines.push(`title: ${yaml(args.title)}`);
  lines.push(args.type ? `type: ${args.type}` : `# type: peak            # ${ADVENTURE_TYPES.join(' | ')}`);
  if (args.sport) lines.push(`sport: ${args.sport}`);
  else lines.push(`# sport: ${sportGuess}        # override only (e.g. Scramble, Mountaineering); else derived`);
  if (args.tags?.length) lines.push(`tags: [${args.tags.map(yaml).join(', ')}]`);
  else lines.push('# tags: [colorado, sawatch]   # editorial: range / place / route tokens');
  lines.push(args.difficulty ? `difficulty: ${args.difficulty}` : `# difficulty: hard      # ${DIFFICULTIES.join(' | ')}`);
  if (group) lines.push(`group: ${yaml(group)}`);
  else lines.push('# group: route-key      # repeat trips of one route (auto-attached by GPS when known)');
  if (laps) lines.push('laps: true');
  if (args.race) lines.push('race: true');
  if (args.duathlon) lines.push('duathlon: true');

  const md = `---\n${lines.join('\n')}\n---\n`;

  // Validate BEFORE writing: a failed scaffold should leave nothing behind, and there is no window
  // in which a broken companion exists on disk to trip up adventure:validate or the build.
  const errs = validateCompanionFrontmatter(matter(md).data as Record<string, unknown>, `${slug}.md`);
  if (errs.length) {
    console.error('[adventure:new] scaffold failed validation — nothing written:');
    for (const e of errs) console.error('  ✗ ' + e);
    process.exit(1);
  }

  fs.writeFileSync(file, md);

  console.log(`[adventure:new] ✓ wrote content/adventures/${slug}.md`);
  console.log(`    ${detail.name} — ${date} · ${km} km · ${gain} m gain`);
  console.log('\nNext:');
  console.log(`  1. edit content/adventures/${slug}.md — fill the editorial fields: type, difficulty, tags`);
  console.log(`  2. npm run sync:strava -- --only ${args.id}   # fetch maps/photos/stats for just this activity`);
  console.log('  3. npm run adventure:validate                # confirm it is well-formed');
}

main().catch((err) => {
  console.error('[adventure:new]', err);
  process.exit(1);
});
