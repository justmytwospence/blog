/**
 * Idempotent migration: strip frontmatter the pipeline now derives, leaving only editorial deltas.
 * Removes a top-level key when it merely echoes the committed snapshot (the site derives it):
 *   - `title`  when it equals the Strava name
 *   - `sport`  when it equals the derived SportType (Scramble/Mountaineering overrides differ → kept)
 *   - `date`   when it equals the snapshot date
 *   - `hidden` when it is `false` (dead — the site defaults absent → not hidden; `hidden: true` kept)
 *   - `race`   when Strava's workout_type already derives it (Run 1 / Ride 11); non-run/ride races
 *              (triathlons, ski marathons — workout_type can't express them) keep their explicit flag
 *
 * Requires the snapshots to carry `workoutType` — run `npm run sync:strava` FIRST so the backfill
 * populates it (otherwise `race` is conservatively left in place). Edits lines in place (no YAML
 * re-serialization) so nothing else churns. Preserves intentional overrides + peakClass edge cases.
 *
 *   npm run adventure:minimize   (or: npx tsx scripts/minimize-frontmatter.ts)
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseStravaIds } from '@blog/strava';
import { CONTENT_DIR, ACTIVITIES_DIR, listCompanionFiles } from './strava-shared';

interface Snap {
  name: string;
  sportType: string;
  date: string;
  workoutType?: number | null;
}

const RACE_WORKOUT_TYPES = new Set([1, 11]); // Strava: Run 1 = race, Ride 11 = race

function snapshotDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function main(): void {
  let touched = 0;
  let missingWorkoutType = 0;
  const removedByKey: Record<string, number> = { title: 0, sport: 0, date: 0, hidden: 0, race: 0 };

  for (const file of listCompanionFiles()) {
    const full = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { data } = matter(raw);
    const ids = parseStravaIds(data);
    if (ids.length === 0) continue;
    const snapPath = path.join(ACTIVITIES_DIR, `${ids[0]}.json`);
    if (!fs.existsSync(snapPath)) continue;
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Snap;

    const strip = new Set<string>();
    if (data.title != null && String(data.title) === snap.name) strip.add('title');
    if (data.sport != null && String(data.sport) === snap.sportType) strip.add('sport');
    if (data.date != null && snapshotDate(data.date) === snap.date) strip.add('date');
    if (data.hidden === false) strip.add('hidden');
    if (data.race === true) {
      if (snap.workoutType === undefined) missingWorkoutType++;
      else if (typeof snap.workoutType === 'number' && RACE_WORKOUT_TYPES.has(snap.workoutType)) strip.add('race');
    }
    if (strip.size === 0) continue;

    // Remove only the top-level key lines (a `days:` block's indented `- title:` stays).
    const lines = raw.split('\n');
    const kept = lines.filter((line) => {
      const m = line.match(/^(title|sport|date|hidden|race):/);
      if (m && strip.has(m[1])) {
        removedByKey[m[1]]++;
        return false;
      }
      return true;
    });
    fs.writeFileSync(full, kept.join('\n'));
    touched++;
  }

  console.log(
    `[minimize] ${touched} files trimmed — ` +
      `title:${removedByKey.title} sport:${removedByKey.sport} date:${removedByKey.date} ` +
      `hidden:${removedByKey.hidden} race:${removedByKey.race}`,
  );
  if (missingWorkoutType) {
    console.warn(
      `[minimize] ${missingWorkoutType} file(s) with race: true have no workoutType in their snapshot — ` +
        `run \`npm run sync:strava\` first to backfill it, then re-run to minimize those.`,
    );
  }
}

main();
