/**
 * Targeted one-off route fixes (does NOT rewrite the other 14er reports):
 *   - Little Bear: rebuild the activity from the correct standard route (litt2, NW Face) — the import
 *     had resolved it to litt3 (the Little Bear↔Blanca traverse), leaving a broken 1.2 mi fragment.
 *   - Crestone Traverse: add a new report from the dedicated "Crestones Traverse" route (cnee3).
 *
 *   npm run source:routes
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  encodePolyline,
  downsampleTrack,
  reverseGeocode,
  type TrackPoint,
  type AdventureActivity,
  type SportType,
} from '@blog/strava';
import { ACTIVITIES_DIR, CONTENT_DIR, PUBLIC_DIR } from './strava-shared';
import { buildRouteThumb } from './route-thumb';

const GPX_URL = (slug: string) => `https://www.14ers.com/php14ers/download.php?file=${slug}.gpx&type=routegpx`;
const ROUTE_URL = (slug: string) => `https://www.14ers.com/route.php?route=${slug}`;

const haversine = (a: [number, number], b: [number, number]): number => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function parseGpx(xml: string): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  for (const c of xml.split(/<(?:trkpt|rtept)\b/).slice(1)) {
    const lat = c.match(/\blat="([\-0-9.]+)"/);
    const lon = c.match(/\blon="([\-0-9.]+)"/);
    const ele = c.match(/<ele>([\-0-9.]+)<\/ele>/);
    if (lat && lon) pts.push([Number(lat[1]), Number(lon[1]), ele ? Number(ele[1]) : 0]);
  }
  return pts;
}

async function buildActivity(
  slug: string,
  id: number,
  name: string,
  sport: SportType,
  date: string,
): Promise<{ activity: AdventureActivity; latlng: Array<[number, number]> }> {
  const res = await fetch(GPX_URL(slug), { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ROUTE_URL(slug) } });
  if (!res.ok) throw new Error(`${slug}: GPX ${res.status}`);
  const raw = parseGpx(await res.text());
  if (raw.length < 2) throw new Error(`${slug}: no trackpoints`);

  const dist: number[] = [0];
  for (let i = 1; i < raw.length; i++) dist.push(dist[i - 1] + haversine([raw[i - 1][0], raw[i - 1][1]], [raw[i][0], raw[i][1]]));
  const grade: number[] = raw.map((_, i) => {
    if (i === 0) return 0;
    let j = i - 1;
    while (j > 0 && dist[i] - dist[j] < 25) j--;
    const dd = dist[i] - dist[j];
    return dd > 0 ? Math.max(-60, Math.min(60, ((raw[i][2] - raw[j][2]) / dd) * 100)) : 0;
  });
  let gain = 0, hi = -Infinity, lo = Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0 && raw[i][2] > raw[i - 1][2]) gain += raw[i][2] - raw[i - 1][2];
    hi = Math.max(hi, raw[i][2]); lo = Math.min(lo, raw[i][2]);
  }

  const tps: TrackPoint[] = raw.map((p, i) => ({ lat: p[0], lng: p[1], alt: p[2], dist: dist[i], grade: grade[i], vel: 0, hr: 0 }));
  const ds = downsampleTrack(tps, { maxPoints: 1200 });
  const summit = raw.reduce((best, p) => (p[2] > best[2] ? p : best), raw[0]);
  const geo = await reverseGeocode(summit[0], summit[1]);

  const activity: AdventureActivity = {
    stravaId: id,
    name,
    sportType: sport,
    startLocal: `${date}T08:00:00Z`,
    date,
    timezone: null,
    location: geo ?? { city: null, state: 'Colorado', country: 'United States' },
    stats: {
      distanceMeters: Math.round(dist[dist.length - 1]),
      movingTimeSeconds: 0,
      elapsedTimeSeconds: 0,
      elevationGainMeters: Math.round(gain),
      elevHighMeters: Math.round(hi),
      elevLowMeters: Math.round(lo),
      avgSpeedMetersPerSec: 0,
      maxSpeedMetersPerSec: 0,
      avgHeartrate: null,
      maxHeartrate: null,
      avgCadence: null,
      avgWatts: null,
      maxWatts: null,
      calories: null,
      sufferScore: null,
    },
    track: {
      coordinates: ds.map((p) => [p.lng, p.lat]),
      altitude: ds.map((p) => Math.round(p.alt)),
      distance: ds.map((p) => Math.round(p.dist)),
      grade: ds.map((p) => +p.grade.toFixed(1)),
      velocity: [],
      heartrate: [],
      summaryPolyline: encodePolyline(ds.map((p) => [p.lat, p.lng])),
      bounds: null,
      pointCount: ds.length,
    },
    weather: null,
    photos: [],
    gear: null,
    description: null,
    stravaUrl: '',
    syncedAt: new Date().toISOString(),
    sourceHash: `14ers:${slug}`,
  };
  return { activity, latlng: ds.map((p) => [p.lat, p.lng]) };
}

async function main(): Promise<void> {
  // #8 — Little Bear: rebuild the activity from the correct standard route (keep the existing report).
  const lb = await buildActivity('litt2', 10044, 'Little Bear Peak', 'Mountaineering', '2020-10-05');
  fs.writeFileSync(path.join(ACTIVITIES_DIR, '10044.json'), JSON.stringify(lb.activity, null, 2));
  await buildRouteThumb(lb.latlng, path.join(PUBLIC_DIR, '10044', 'route.jpg'));
  const lbMd = path.join(CONTENT_DIR, 'little-bear-peak.md');
  fs.writeFileSync(lbMd, fs.readFileSync(lbMd, 'utf8').replace(/route=litt3/g, 'route=litt2'));
  console.log(`[routes] Little Bear -> ${(lb.activity.stats.distanceMeters / 1609.344).toFixed(1)} mi`);

  // #9 — Crestone Traverse: new report from the dedicated traverse route.
  const ct = await buildActivity('cnee3', 10070, 'Crestone Traverse', 'Mountaineering', '2021-09-04');
  fs.writeFileSync(path.join(ACTIVITIES_DIR, '10070.json'), JSON.stringify(ct.activity, null, 2));
  await buildRouteThumb(ct.latlng, path.join(PUBLIC_DIR, '10070', 'route.jpg'));
  const fm = [
    '---',
    'title: "Crestone Traverse"',
    'strava_id: 10070',
    'date: 2021-09-04',
    'sport: Mountaineering',
    'type: traverse',
    'difficulty: epic',
    'tags: [14er, sangre-de-cristo, traverse]',
    'source: 14ers',
    'hidden: false',
    '---',
    '',
    'The Crestone Traverse — Crestone Needle to Crestone Peak across the connecting ridge, Class 5.0. ' +
      'Climbed before I was on Strava. _Date approximate._',
    '',
    'Route on 14ers.com: [Crestones Traverse](https://www.14ers.com/route.php?route=cnee3)',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(CONTENT_DIR, 'crestone-traverse.md'), fm);
  console.log(`[routes] Crestone Traverse -> ${(ct.activity.stats.distanceMeters / 1609.344).toFixed(1)} mi`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
