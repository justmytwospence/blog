/**
 * Write the local (gitignored) lifetime + yearly totals from the all-activity index, for dev.
 * `buildTotals` itself now lives in @blog/strava (pure, runtime-safe); this is just the fs wrapper
 * + CLI. The committed totals are gone — production reads them from the runtime store (Redis).
 *
 *   npx tsx scripts/build-totals.ts
 */
import fs from 'node:fs';
import { buildTotals, type AllActivityEntry } from '@blog/strava';
import { ALL_ACTIVITIES_FILE, LIFETIME_FILE, YEARLY_FILE } from './strava-shared';

export { buildTotals };

export function writeTotals(entries: AllActivityEntry[]): void {
  const { lifetime, yearly } = buildTotals(entries);
  fs.writeFileSync(LIFETIME_FILE, `${JSON.stringify(lifetime, null, 2)}\n`);
  fs.writeFileSync(YEARLY_FILE, `${JSON.stringify(yearly, null, 2)}\n`);
  console.log(`[totals] ${entries.length} indexed → ${lifetime.activityCount} human-powered, ${lifetime.bySport.length} sports`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = JSON.parse(fs.readFileSync(ALL_ACTIVITIES_FILE, 'utf8')) as AllActivityEntry[];
  writeTotals(entries);
}
