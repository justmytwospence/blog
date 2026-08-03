/**
 * One-shot, idempotent taxonomy migration to the single-source model:
 *  - `type` becomes terrain/objective only (drop the `trail-run` sport echo; `race` -> `race: true`).
 *  - terrain facets come from `type`, so backfill `type` from a terrain tag/title where it was implicit.
 *  - `race`/`duathlon` become flags (the facet's single source).
 *  - `14er`/`13er` move to an explicit `peakClass` override ONLY where the GPX elevation won't derive it.
 *  - `tags` keep place/range only; strip facet/sport/flag echoes.
 *
 *   npx tsx scripts/migrate-taxonomy.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseStravaIds } from '@blog/strava';
import { CONTENT_DIR, ACTIVITIES_DIR, listCompanionFiles } from './strava-shared';
import { derivePeakClass } from '../lib/adventure-schema';

const TERRAIN = ['couloir', 'scramble', 'traverse', 'thru-hike'];
const DROP_TAGS = new Set([
  '14er', '13er', 'race', 'duathlon', 'couloir', 'scramble', 'traverse', 'thru-hike', 'peak', 'mountaineering',
  'skimo', 'gravel', 'rollerski', 'road', 'trail-run', 'laps', 'uphill', 'vert',
]);

function snapField<T>(
  ids: number[],
  pick: (s: { stats: { elevHighMeters: number | null }; sportType: string; name: string }) => T,
): T[] {
  const out: T[] = [];
  for (const id of ids) {
    const p = path.join(ACTIVITIES_DIR, `${id}.json`);
    if (fs.existsSync(p)) out.push(pick(JSON.parse(fs.readFileSync(p, 'utf8'))));
  }
  return out;
}

/** Whether elevation alone already yields `cls`, so an explicit peakClass override isn't needed.
 *  Shares the render-time derivation rather than replicating it (passing no explicit override). */
function elevationGives(cls: string, type: string | null, sport: string | null, elevHigh: number): boolean {
  return derivePeakClass(null, type, sport, elevHigh) === cls;
}

let changed = 0;
for (const file of listCompanionFiles()) {
  const full = path.join(CONTENT_DIR, file);
  const raw = fs.readFileSync(full, 'utf8');
  const { data } = matter(raw);
  const ids = parseStravaIds(data);
  const tags: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
  const title = String(data.title ?? '').toLowerCase();
  let type: string | null = data.type ? String(data.type) : null;

  const add: Record<string, string> = {};
  let removeType = false;

  if (type === 'race') {
    add.race = 'true';
    removeType = true;
    type = null;
  } else if (type === 'trail-run') {
    removeType = true;
    type = null;
  }
  if (tags.includes('race') && !data.race) add.race = 'true';
  if ((tags.includes('duathlon') || /duathlon/.test(title)) && !data.duathlon) add.duathlon = 'true';

  // Backfill terrain type from a terrain tag, else a keyword in the title / Strava name / slug (the
  // report title may have been minimized away, so fall back to the snapshot name + filename).
  if (!type) {
    const hay = `${title} ${(snapField(ids, (s) => s.name)[0] ?? '').toLowerCase()} ${file.toLowerCase()}`;
    const terr = TERRAIN.find((t) => tags.includes(t)) ?? TERRAIN.find((t) => t !== 'thru-hike' && hay.includes(t));
    if (terr) {
      add.type = terr;
      type = terr;
    }
  }

  const elevHigh = Math.max(Number.NEGATIVE_INFINITY, ...snapField(ids, (s) => s.stats.elevHighMeters ?? Number.NEGATIVE_INFINITY));
  const sport = (data.sport ? String(data.sport) : null) ?? snapField(ids, (s) => s.sportType)[0] ?? null;
  for (const cls of ['14er', '13er']) {
    if (tags.includes(cls) && !data.peakClass && !elevationGives(cls, type, sport, elevHigh)) add.peakClass = cls;
  }

  const keptTags = tags.filter((t) => !DROP_TAGS.has(t));

  // Surgical line edits (preserve formatting): insert new keys after the opening ---, rewrite/remove tags, drop type.
  const lines = raw.split('\n');
  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd < 0) continue;

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && i < fmEnd) {
      if (removeType && /^type:/.test(line)) continue;
      if (/^tags:/.test(line)) {
        if (keptTags.length) out.push(`tags: [${keptTags.join(', ')}]`);
        continue;
      }
    }
    out.push(line);
    if (i === 0 && line.trim() === '---') {
      for (const [k, v] of Object.entries(add)) out.push(`${k}: ${v}`);
    }
  }
  const next = out.join('\n');
  if (next !== raw) {
    fs.writeFileSync(full, next);
    changed++;
  }
}
console.log(`[taxonomy] migrated ${changed} files`);
