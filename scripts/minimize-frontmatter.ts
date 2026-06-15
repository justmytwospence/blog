/**
 * One-shot, idempotent migration: strip redundant `title` / `sport` / `date` frontmatter from report
 * companions when they merely echo the committed snapshot (the site derives those from the snapshot).
 * Intentional overrides — a custom title, a forced sport, a manual date — differ from the snapshot and
 * are left untouched. Edits lines in place (no YAML re-serialization) so nothing else churns.
 *
 *   npx tsx scripts/minimize-frontmatter.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseStravaIds } from '@blog/strava';
import { CONTENT_DIR, ACTIVITIES_DIR } from './strava-shared';

interface Snap {
  name: string;
  sportType: string;
  date: string;
}

function snapshotDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function main(): void {
  let touched = 0;
  const removedByKey: Record<string, number> = { title: 0, sport: 0, date: 0 };

  for (const file of fs.readdirSync(CONTENT_DIR)) {
    if (!file.endsWith('.md') || file === 'objectives.md' || file.startsWith('.')) continue;
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
    if (strip.size === 0) continue;

    // Remove only the top-level key lines (a `days:` block's indented `- title:` stays).
    const lines = raw.split('\n');
    const kept = lines.filter((line) => {
      const m = line.match(/^(title|sport|date):/);
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
    `[minimize] ${touched} files trimmed — title:${removedByKey.title} sport:${removedByKey.sport} date:${removedByKey.date}`,
  );
}

main();
