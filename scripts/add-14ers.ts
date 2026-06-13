/**
 * One-time importer for pre-Strava 14ers logged in a spreadsheet. Reads scripts/14ers.json
 * (peak + 14ers.com route slug + date/class/etc.), downloads the route GPX from 14ers.com,
 * and writes a committed "manual" adventure (activity JSON + content stub + route thumbnail).
 *
 *   npm run add:14ers          # build/refresh all entries
 *
 * These are flagged `source: 14ers` in the companion so the Strava sync skips (but keeps) them.
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
import { ACTIVITIES_DIR, CONTENT_DIR, PUBLIC_DIR, slugify, sleep } from './strava-shared';
import { buildRouteThumb } from './route-thumb';

interface Entry {
  peak: string;
  peakid: number;
  route: string; // 14ers.com route slug, e.g. quan1
  routeName: string;
  date: string;
  class: number;
  height: string;
  range: string;
}

const GPX_URL = (slug: string) =>
  `https://www.14ers.com/php14ers/download.php?file=${slug}.gpx&type=routegpx`;
const ROUTE_URL = (slug: string) => `https://www.14ers.com/route.php?route=${slug}`;

const haversine = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const la1 = a[0] * rad;
  const la2 = b[0] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Parse a GPX into [lat, lng, ele] points (order-independent attrs; trkpt or rtept). */
function parseGpx(xml: string): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const chunks = xml.split(/<(?:trkpt|rtept)\b/).slice(1);
  for (const c of chunks) {
    const lat = c.match(/\blat="([\-0-9.]+)"/);
    const lon = c.match(/\blon="([\-0-9.]+)"/);
    const ele = c.match(/<ele>([\-0-9.]+)<\/ele>/);
    if (lat && lon) pts.push([Number(lat[1]), Number(lon[1]), ele ? Number(ele[1]) : 0]);
  }
  return pts;
}

function sport(cls: number): SportType {
  return cls >= 3 ? 'Mountaineering' : 'Hike';
}
function difficulty(cls: number): string {
  return cls >= 4 ? 'epic' : cls >= 3 ? 'hard' : 'moderate';
}

async function build(e: Entry): Promise<boolean> {
  const res = await fetch(GPX_URL(e.route), {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: ROUTE_URL(e.route) },
  });
  if (!res.ok) {
    console.error(`[14ers] ${e.peak}: GPX ${res.status} (${e.route})`);
    return false;
  }
  const raw = parseGpx(await res.text());
  if (raw.length < 2) {
    console.error(`[14ers] ${e.peak}: no trackpoints in ${e.route}.gpx`);
    return false;
  }

  // Cumulative distance + per-point grade over the full track.
  const dist: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    dist.push(dist[i - 1] + haversine([raw[i - 1][0], raw[i - 1][1]], [raw[i][0], raw[i][1]]));
  }
  const grade: number[] = raw.map((_, i) => {
    if (i === 0) return 0;
    // grade over a ~25 m window to damp GPS/DEM noise
    let j = i - 1;
    while (j > 0 && dist[i] - dist[j] < 25) j--;
    const dd = dist[i] - dist[j];
    return dd > 0 ? Math.max(-60, Math.min(60, ((raw[i][2] - raw[j][2]) / dd) * 100)) : 0;
  });

  let gain = 0;
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0 && raw[i][2] > raw[i - 1][2]) gain += raw[i][2] - raw[i - 1][2];
    hi = Math.max(hi, raw[i][2]);
    lo = Math.min(lo, raw[i][2]);
  }

  // Downsample for rendering (index-aligned channels).
  const tps: TrackPoint[] = raw.map((p, i) => ({ lat: p[0], lng: p[1], alt: p[2], dist: dist[i], grade: grade[i], vel: 0, hr: 0 }));
  const ds = downsampleTrack(tps, { maxPoints: 1200 });

  const coordinates: Array<[number, number]> = ds.map((p) => [p.lng, p.lat]);
  const summaryPolyline = encodePolyline(ds.map((p) => [p.lat, p.lng]));

  // Reverse-geocode the high point (≈ the summit) for location.
  const summit = raw.reduce((best, p) => (p[2] > best[2] ? p : best), raw[0]);
  const geo = await reverseGeocode(summit[0], summit[1]);

  const activity: AdventureActivity = {
    stravaId: e.peakid,
    name: e.peak,
    sportType: sport(e.class),
    startLocal: `${e.date}T08:00:00Z`,
    date: e.date,
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
      coordinates,
      altitude: ds.map((p) => Math.round(p.alt)),
      distance: ds.map((p) => Math.round(p.dist)),
      grade: ds.map((p) => +p.grade.toFixed(1)),
      velocity: [],
      heartrate: [],
      summaryPolyline,
      bounds: null,
      pointCount: ds.length,
    },
    weather: null,
    photos: [],
    gear: null,
    description: `${e.routeName} · Class ${e.class} · ${e.height}`,
    stravaUrl: '',
    syncedAt: new Date().toISOString(),
    sourceHash: `14ers:${e.route}`,
  };

  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIVITIES_DIR, `${e.peakid}.json`), JSON.stringify(activity, null, 2));

  // Companion stub (skip if it already exists so manual edits survive).
  const slug = slugify(e.peak.replace(/^Mt\.?\s/, 'mount-'));
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) {
    const fm = [
      '---',
      `title: "${e.peak}"`,
      `strava_id: ${e.peakid}`,
      `date: ${e.date}`,
      `sport: ${sport(e.class)}`,
      'type: peak',
      `difficulty: ${difficulty(e.class)}`,
      `tags: [14er, ${slugify(e.range)}]`,
      'source: 14ers',
      'hidden: false',
      '---',
      '',
      `${e.peak} (${e.height}) via the ${e.routeName} — Class ${e.class}. A Colorado 14er, climbed before I was on Strava.`,
      '',
      `[Route details on 14ers.com](${ROUTE_URL(e.route)})`,
      '',
    ];
    fs.writeFileSync(file, fm.join('\n'));
  }

  // Route thumbnail (basemap + route) for the card.
  await buildRouteThumb(
    ds.map((p) => [p.lat, p.lng]),
    path.join(PUBLIC_DIR, String(e.peakid), 'route.jpg'),
  );

  console.log(`[14ers] ${e.peak} → ${(dist[dist.length - 1] / 1609.344).toFixed(1)} mi / ${Math.round(gain * 3.28084)} ft (${slug})`);
  return true;
}

async function main(): Promise<void> {
  const entries: Entry[] = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '14ers.json'), 'utf8'));
  let ok = 0;
  for (const e of entries) {
    if (await build(e)) ok++;
    await sleep(400);
  }
  console.log(`[14ers] done — ${ok}/${entries.length} imported.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
