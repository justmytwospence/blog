/**
 * One-time importer for pre-Strava 14ers logged in a spreadsheet. Reads scripts/14ers.json (each
 * entry = one same-day outing with one or more peak "legs"), downloads each leg's route GPX from
 * 14ers.com, and writes a committed "manual" adventure. Same-day link-ups become one multi-leg
 * report (each peak's route is its own track — never stitched into a fake continuous line).
 *
 *   npm run add:14ers
 *
 * Flagged `source: 14ers` so the Strava sync keeps (but never fetches) them.
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

interface Leg {
  peak: string;
  peakid: number;
  route: string;
}
interface Entry {
  peaks: string[];
  note: string;
  date: string;
  class: number;
  height: string;
  range: string;
  legs: Leg[];
}

const GPX_URL = (slug: string) => `https://www.14ers.com/php14ers/download.php?file=${slug}.gpx&type=routegpx`;
const ROUTE_URL = (slug: string) => `https://www.14ers.com/route.php?route=${slug}`;

const haversine = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
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

const sport = (cls: number): SportType => (cls >= 3 ? 'Mountaineering' : 'Hike');
const difficulty = (cls: number): string => (cls >= 4 ? 'epic' : cls >= 3 ? 'hard' : 'moderate');

function titleOf(peaks: string[]): string {
  if (peaks.length === 1) return peaks[0];
  const names = peaks.map((p, i) => (i === 0 ? p : p.replace(/^Mt\.?\s/, '')));
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
function slugOf(peaks: string[]): string {
  if (peaks.length === 1) return slugify(peaks[0].replace(/^Mt\.?\s/, 'mount-'));
  return slugify(peaks.map((p) => p.replace(/^Mt\.?\s/, '').replace(/\s+(Peak|Mountain|Point)$/, '')).join('-'));
}

/** Fetch + parse a leg's GPX into a committed AdventureActivity; returns it plus the [lat,lng] track. */
async function buildLeg(leg: Leg, e: Entry): Promise<{ activity: AdventureActivity; latlng: Array<[number, number]> } | null> {
  if (!leg.route) {
    console.error(`[14ers] ${leg.peak}: no route slug`);
    return null;
  }
  const res = await fetch(GPX_URL(leg.route), { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ROUTE_URL(leg.route) } });
  if (!res.ok) {
    console.error(`[14ers] ${leg.peak}: GPX ${res.status} (${leg.route})`);
    return null;
  }
  const raw = parseGpx(await res.text());
  if (raw.length < 2) {
    console.error(`[14ers] ${leg.peak}: no trackpoints in ${leg.route}.gpx`);
    return null;
  }

  const dist: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    dist.push(dist[i - 1] + haversine([raw[i - 1][0], raw[i - 1][1]], [raw[i][0], raw[i][1]]));
  }
  const grade: number[] = raw.map((_, i) => {
    if (i === 0) return 0;
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

  const tps: TrackPoint[] = raw.map((p, i) => ({ lat: p[0], lng: p[1], alt: p[2], dist: dist[i], grade: grade[i], vel: 0, hr: 0 }));
  const ds = downsampleTrack(tps, { maxPoints: 1200 });
  const summit = raw.reduce((best, p) => (p[2] > best[2] ? p : best), raw[0]);
  const geo = await reverseGeocode(summit[0], summit[1]);

  const activity: AdventureActivity = {
    stravaId: leg.peakid,
    name: leg.peak,
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
    description: `${leg.route} · Class ${e.class}`,
    stravaUrl: '',
    syncedAt: new Date().toISOString(),
    sourceHash: `14ers:${leg.route}`,
  };
  return { activity, latlng: ds.map((p) => [p.lat, p.lng]) };
}

async function build(e: Entry): Promise<boolean> {
  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });
  const tracks: Array<Array<[number, number]>> = [];
  const peakids: number[] = [];
  for (const leg of e.legs) {
    const built = await buildLeg(leg, e);
    if (!built) return false;
    fs.writeFileSync(path.join(ACTIVITIES_DIR, `${leg.peakid}.json`), JSON.stringify(built.activity, null, 2));
    tracks.push(built.latlng);
    peakids.push(leg.peakid);
    await sleep(250);
  }

  const t = titleOf(e.peaks);
  const slug = slugOf(e.peaks);
  const multi = e.legs.length > 1;
  const fm = ['---', `title: "${t.replace(/"/g, '\\"')}"`];
  fm.push(multi ? `strava_ids: [${peakids.join(', ')}]` : `strava_id: ${peakids[0]}`);
  fm.push(`date: ${e.date}`, `sport: ${sport(e.class)}`, 'type: peak', `difficulty: ${difficulty(e.class)}`, `tags: [14er, ${slugify(e.range)}]`, 'source: 14ers', 'hidden: false');
  if (multi) {
    fm.push('days:');
    for (const leg of e.legs) fm.push(`  - title: "${leg.peak.replace(/"/g, '\\"')}"`);
  }
  const summits = multi ? `the ${e.peaks.length} summits (${e.peaks.join(', ')})` : `${e.peaks[0]} (${e.height})`;
  fm.push('---', '', `A Colorado 14er${multi ? ' link-up' : ''} via the ${e.note} — ${summits}, Class ${e.class}. Climbed before I was on Strava.`, '');
  fm.push(`Routes on 14ers.com: ${e.legs.map((l) => `[${l.peak}](${ROUTE_URL(l.route)})`).join(' · ')}`, '');
  fs.writeFileSync(path.join(CONTENT_DIR, `${slug}.md`), fm.join('\n'));

  // Combined thumbnail at the primary peak's id (each leg drawn as its own track).
  await buildRouteThumb(tracks, path.join(PUBLIC_DIR, String(peakids[0]), 'route.jpg'));
  console.log(`[14ers] ${t.padEnd(46)} ${e.legs.length} leg(s) → ${slug}`);
  return true;
}

async function main(): Promise<void> {
  const entries: Entry[] = JSON.parse(
    fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '14ers.json'), 'utf8'),
  );
  let ok = 0;
  for (const e of entries) {
    if (await build(e)) ok++;
    await sleep(300);
  }
  console.log(`[14ers] done — ${ok}/${entries.length} outings imported.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
