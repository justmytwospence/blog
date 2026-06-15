/**
 * Rebuild every committed route thumbnail from the stored snapshot (offline — no Strava calls).
 * Use after changing the thumbnail framing/style.
 *
 *   npm run strava:thumbs
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodePolyline } from '@blog/strava';
import { ACTIVITIES_DIR, PUBLIC_DIR } from './strava-shared';
import { buildRouteThumb } from './route-thumb';

async function main(): Promise<void> {
  if (!fs.existsSync(ACTIVITIES_DIR)) {
    console.error('no activities snapshot — run npm run sync:strava first');
    process.exit(1);
  }
  const files = fs.readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.json'));
  let done = 0;
  let skipped = 0;
  for (const f of files) {
    const a = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, f), 'utf8'));
    const poly: string | undefined = a.track?.summaryPolyline;
    if (!poly) {
      skipped++;
      continue;
    }
    const out = path.join(PUBLIC_DIR, String(a.stravaId), 'route.jpg');
    const ok = await buildRouteThumb(decodePolyline(poly), out);
    if (ok) done++;
    else skipped++;
    if (done % 10 === 0) process.stdout.write(`\r[thumbs] ${done} rebuilt...`);
  }
  console.log(`\n[thumbs] rebuilt ${done}, skipped ${skipped} (no polyline / tile fetch failed)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
