/**
 * Validate every adventure companion's frontmatter against the shared schema.
 *
 *   npm run adventure:validate
 *
 * Exits non-zero on any malformed companion. Wired into CI so a typo'd or out-of-enum
 * companion fails the build instead of silently rendering wrong.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseStravaIds, isRaceWorkoutType } from '@blog/strava';
import { CONTENT_DIR, ACTIVITIES_DIR, listCompanionFiles, readLocalPhotos } from './strava-shared';
import { validateCompanionFrontmatter } from '../lib/adventure-schema';

interface Snap { name: string; sportType: string; date: string; workoutType?: number | null }

/** Non-fatal drift check: flag frontmatter the pipeline now derives (run `npm run adventure:minimize`
 *  to strip). Keeps the minimized contract from silently regressing without failing the build. */
function redundantKeys(data: Record<string, unknown>): string[] {
  const ids = parseStravaIds(data);
  if (ids.length === 0) return [];
  const snapPath = path.join(ACTIVITIES_DIR, `${ids[0]}.json`);
  if (!fs.existsSync(snapPath)) return [];
  let snap: Snap;
  try {
    snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Snap;
  } catch {
    return [];
  }
  const dead: string[] = [];
  if (data.title != null && String(data.title) === snap.name) dead.push('title');
  if (data.sport != null && String(data.sport) === snap.sportType) dead.push('sport');
  if (data.date != null && String(data.date).slice(0, 10) === snap.date) dead.push('date');
  if (data.hidden === false) dead.push('hidden');
  if (data.race === true && isRaceWorkoutType(snap.workoutType)) dead.push('race');
  return dead;
}

/** Non-fatal: a `cover_photo` that matches no photo (e.g. it was deleted on Strava) silently falls
 *  back to the first photo on the site. Mirrors lib/adventures.ts (`src.endsWith(cover)`). */
function unmatchedCover(data: Record<string, unknown>): string | null {
  const cover = data.cover_photo == null || data.cover_photo === '' ? null : String(data.cover_photo);
  if (cover === null || cover === 'none') return null;
  const srcs: string[] = [];
  for (const id of parseStravaIds(data)) {
    const snapPath = path.join(ACTIVITIES_DIR, `${id}.json`);
    if (!fs.existsSync(snapPath)) return null; // not synced yet — can't judge
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as { photos?: { file: string }[] };
    for (const p of [...(snap.photos ?? []), ...readLocalPhotos(id)]) srcs.push(`/adventures/${id}/${p.file}`);
  }
  return srcs.some((s) => s.endsWith(cover)) ? null : cover;
}

function main(): void {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`[adventure:validate] no content dir at ${CONTENT_DIR}`);
    process.exit(1);
  }
  const files = listCompanionFiles();

  const errors: string[] = [];
  const drift: string[] = [];
  const covers: string[] = [];
  for (const f of files) {
    let data: Record<string, unknown>;
    try {
      data = matter(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')).data as Record<string, unknown>;
    } catch (err) {
      errors.push(`${f}: could not parse frontmatter — ${(err as Error).message}`);
      continue;
    }
    errors.push(...validateCompanionFrontmatter(data, f));
    const dead = redundantKeys(data);
    if (dead.length) drift.push(`${f}: redundant derivable key(s) ${dead.join(', ')}`);
    const cover = unmatchedCover(data);
    if (cover) covers.push(`${f}: cover_photo "${cover}" matches no photo — falling back to the first`);
  }

  if (errors.length > 0) {
    console.error(`\n[adventure:validate] ${errors.length} problem(s) across ${files.length} companions:\n`);
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  if (drift.length > 0) {
    console.warn(`\n[adventure:validate] ${drift.length} companion(s) carry derivable frontmatter — run \`npm run adventure:minimize\`:`);
    for (const d of drift) console.warn('  · ' + d);
  }
  if (covers.length > 0) {
    console.warn(`\n[adventure:validate] ${covers.length} companion(s) have an unmatched cover_photo:`);
    for (const c of covers) console.warn('  · ' + c);
  }
  console.log(`[adventure:validate] ✓ ${files.length} companions valid`);
}

main();
