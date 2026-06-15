/**
 * One-time importer for the 2017 NoBo Pacific Crest Trail thru-hike (pre-Strava). Reads an ordered
 * [lat,lng] track stitched from the OpenStreetMap PCT relation (scripts/pct-coords.json), downsamples
 * it, and writes a committed "manual" adventure with a route thumbnail. No elevation is available from
 * the OSM centerline, so the published PCT totals are used for gain/high/low.
 *
 *   npm run add:pct
 *
 * Flagged `source: pct` so the Strava sync keeps (but never fetches) it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  encodePolyline,
  downsampleTrack,
  reverseGeocode,
  type TrackPoint,
  type AdventureActivity,
} from '@blog/strava';
import { ACTIVITIES_DIR, CONTENT_DIR, PUBLIC_DIR } from './strava-shared';
import { buildRouteThumb } from './route-thumb';

const STRAVA_ID = 20170415; // synthetic id (start date) — no real Strava activity exists
const SLUG = 'pacific-crest-trail';
const DATE = '2017-04-15';
const COORDS_FILE = path.join(process.env.CLAUDE_JOB_DIR || '/tmp', 'tmp', 'pct-coords.json');

// Published PCT figures (the OSM centerline carries no elevation; the stitched track length is
// inflated a few % by stitching artifacts, so use the canonical trail distance for the stat).
const DISTANCE_M = 4265000; // ~2,650 mi, the canonical PCT length
const ELEV_GAIN_M = 149047; // ~489,000 ft
const ELEV_HIGH_M = 4009; // Forester Pass, 13,153 ft
const ELEV_LOW_M = 43; // Columbia River near Cascade Locks, ~140 ft

const haversine = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function main(): Promise<void> {
  const coords: Array<[number, number]> = JSON.parse(fs.readFileSync(COORDS_FILE, 'utf8'));
  if (coords.length < 100) throw new Error(`PCT coords look wrong (${coords.length} points)`);

  const dist: number[] = [0];
  for (let i = 1; i < coords.length; i++) dist.push(dist[i - 1] + haversine(coords[i - 1], coords[i]));
  const totalM = dist[dist.length - 1];

  const tps: TrackPoint[] = coords.map((p, i) => ({ lat: p[0], lng: p[1], alt: 0, dist: dist[i], grade: 0, vel: 0, hr: 0 }));
  const ds = downsampleTrack(tps, { maxPoints: 2500 });

  // Mexican border (southern terminus, Campo CA) for the location label.
  const start = coords[0];
  const geo = await reverseGeocode(start[0], start[1]);

  const activity: AdventureActivity = {
    stravaId: STRAVA_ID,
    name: 'Pacific Crest Trail',
    sportType: 'Hike',
    startLocal: `${DATE}T07:00:00Z`,
    date: DATE,
    timezone: null,
    location: geo ?? { city: 'Campo', state: 'California', country: 'United States' },
    stats: {
      distanceMeters: DISTANCE_M,
      movingTimeSeconds: 0,
      elapsedTimeSeconds: 0,
      elevationGainMeters: ELEV_GAIN_M,
      elevHighMeters: ELEV_HIGH_M,
      elevLowMeters: ELEV_LOW_M,
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
      altitude: [],
      distance: ds.map((p) => Math.round(p.dist)),
      grade: [],
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
    sourceHash: 'pct:osm-1225378',
  };

  fs.mkdirSync(ACTIVITIES_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIVITIES_DIR, `${STRAVA_ID}.json`), JSON.stringify(activity, null, 2));

  const fm = [
    '---',
    'title: "Pacific Crest Trail"',
    `strava_id: ${STRAVA_ID}`,
    `date: ${DATE}`,
    'sport: Hike',
    'type: thru-hike',
    'difficulty: epic',
    'rating: 5',
    'featured: true',
    'tags: [thru-hike, pct, california, oregon, washington]',
    'source: pct',
    'hidden: false',
    '---',
    '',
    'Northbound on the Pacific Crest Trail — Mexico to Canada, roughly April through September 2017. ' +
      '~2,650 miles from the Campo border wall through the desert, the High Sierra, and the Cascades to Manning Park.',
    '',
    '_Route from the [OpenStreetMap PCT relation](https://www.openstreetmap.org/relation/1225378). Photos to come._',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(CONTENT_DIR, `${SLUG}.md`), fm);

  await buildRouteThumb(
    ds.map((p) => [p.lat, p.lng]),
    path.join(PUBLIC_DIR, String(STRAVA_ID), 'route.jpg'),
  );

  console.log(
    `[pct] ${SLUG} — ${(totalM / 1609.344).toFixed(0)} mi, ${ds.length} pts (downsampled from ${coords.length}).`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
