/**
 * Authoring script: turns each to-do objective's frontmatter `route` spec into a committed track
 * (data/objectives/routes/<slug>.json, AdventureTrack-shaped so RouteMap / ElevationProfile render it),
 * and resolves each `wikidata` QID into link URLs (data/objectives/wikidata.json). The site build never
 * calls these APIs; rerun this after adding or changing a route spec or QID.
 *
 *   npm run objectives:build                  # builds routes whose spec hash changed + refreshes links
 *   npm run objectives:build -- --only a,b    # just these slugs
 *   npm run objectives:build -- --force       # rebuild every route
 *
 * Sources: OSM API (relation geometry), BRouter (routed trails), Open-Meteo Copernicus DEM with
 * OpenTopoData SRTM/ASTER as the fallback. Responses are cached in node_modules/.cache/objectives.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { isCompanionFile } from '../lib/adventure-schema';
import { validateObjectiveFrontmatter, type RouteSpec } from '../lib/objective-schema';
import {
  densify,
  haversine,
  mirror,
  routeStats,
  stitch,
  thin,
  withDistance,
  buildTrack,
  type LatLng,
  type Pt3,
  type Pt4,
} from '../lib/objective-geo';

const ROOT = process.cwd();
const OBJECTIVES_DIR = path.join(ROOT, 'content', 'objectives');
const OUT_DIR = path.join(ROOT, 'data', 'objectives');
const ROUTES_DIR = path.join(OUT_DIR, 'routes');
const WIKIDATA_FILE = path.join(OUT_DIR, 'wikidata.json');
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'objectives');
const UA = 'blog-objectives/1.0 (https://spencerboucher.com; spencer@spencerboucher.com)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Network with a disk cache ─────────────────────────────────────────────────────────────────

/** GET/POST text with a disk cache (sha1 of url + body) and backoff on 429/5xx. */
async function fetchText(url: string, init: RequestInit = {}, tries = 6): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const key = crypto
    .createHash('sha1')
    .update(url + (init.body ? String(init.body) : ''))
    .digest('hex');
  const file = path.join(CACHE_DIR, key);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`);
      const text = await res.text();
      if (res.ok) fs.writeFileSync(file, text);
      else throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}: ${text.slice(0, 120)}`);
      return text;
    } catch (e) {
      last = e;
      await sleep(10_000 * (i + 1));
    }
  }
  throw last;
}

// ─── Geometry sources ──────────────────────────────────────────────────────────────────────────

interface OsmFull {
  elements: Array<{
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
    members?: Array<{ type: string; ref: number }>;
  }>;
}

/** Every way of the relation(s), walking child relations (the /full endpoint does not recurse). */
async function osmRelationWays(ids: number[]): Promise<LatLng[][]> {
  const seen = new Set<number>();
  const ways: LatLng[][] = [];
  async function go(id: number): Promise<void> {
    if (seen.has(id)) return;
    seen.add(id);
    const j = JSON.parse(await fetchText(`https://api.openstreetmap.org/api/0.6/relation/${id}/full.json`)) as OsmFull;
    await sleep(1000);
    const nodes = new Map<number, LatLng>();
    for (const e of j.elements) if (e.type === 'node' && e.lat != null && e.lon != null) nodes.set(e.id, [e.lat, e.lon]);
    for (const e of j.elements) {
      if (e.type !== 'way' || !e.nodes) continue;
      const g = e.nodes.map((n) => nodes.get(n)).filter((p): p is LatLng => Boolean(p));
      if (g.length > 1) ways.push(g);
    }
    const top = j.elements.find((e) => e.type === 'relation' && e.id === id);
    for (const m of top?.members ?? []) if (m.type === 'relation') await go(m.ref);
  }
  for (const id of ids) await go(id);
  return ways;
}

/** BRouter geojson route with elevation. via: [[lat,lng],...]. */
async function brouter(via: LatLng[], profile: string): Promise<Pt3[]> {
  const lonlats = via.map(([la, ln]) => `${ln},${la}`).join('|');
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
  const text = await fetchText(url);
  await sleep(1500);
  let j: { features: Array<{ geometry: { coordinates: Array<[number, number, number]> } }> };
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`brouter: ${text.slice(0, 160)}`);
  }
  return j.features[0].geometry.coordinates.map(([ln, la, e]) => [la, ln, e] as Pt3);
}

let openMeteoDown = false;

/** Elevations (m) for points: Open-Meteo Copernicus, falling back per chunk to OpenTopoData SRTM/ASTER. */
async function dem(pts: LatLng[]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    let got: number[] | null = null;
    if (!openMeteoDown) {
      try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p[0].toFixed(5)).join(',')}&longitude=${chunk.map((p) => p[1].toFixed(5)).join(',')}`;
        const j = JSON.parse(await fetchText(url, {}, 1)) as { elevation?: number[] };
        if (Array.isArray(j.elevation) && j.elevation.length === chunk.length) got = j.elevation;
        await sleep(300);
      } catch {
        openMeteoDown = true; // quota / outage: stop trying for the rest of the run
      }
    }
    if (!got) {
      const url = `https://api.opentopodata.org/v1/srtm30m,aster30m?locations=${chunk.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|')}`;
      const j = JSON.parse(await fetchText(url)) as { results?: Array<{ elevation: number | null }> };
      if (!Array.isArray(j.results)) throw new Error('opentopodata: bad response');
      let prev = out.length ? out[out.length - 1] : 0;
      got = j.results.map((r) => {
        if (r.elevation != null) prev = r.elevation;
        return prev;
      });
      await sleep(1100);
    }
    out.push(...got);
  }
  return out;
}

// ─── Route building ────────────────────────────────────────────────────────────────────────────

interface Built {
  pts: Pt4[];
  approx: boolean;
}

async function resolve(spec: RouteSpec): Promise<Built | null> {
  let pts: Pt4[];
  let approx = false;
  if (spec.kind === 'none') return null;
  if (spec.kind === 'osm') {
    const ways = await osmRelationWays(spec.relations);
    if (!ways.length) throw new Error('osm: no ways');
    // Distance is measured on the full stitched line; only then thin for DEM sampling and storage.
    const full = withDistance(stitch(ways, spec.start));
    const thinned = thin(full, 600);
    const ele = await dem(thinned.map((p) => [p[0], p[1]] as LatLng));
    pts = thinned.map((p, i) => [p[0], p[1], ele[i], p[3]] as Pt4);
  } else if (spec.kind === 'brouter') {
    let line = await brouter(spec.via as LatLng[], spec.profile);
    const end = spec.via[spec.via.length - 1] as LatLng;
    if (haversine(line[line.length - 1], end) > 150) {
      // The router could not reach the final point (summit off the trail network): finish straight.
      const tail = densify([[line[line.length - 1][0], line[line.length - 1][1]], end], 100).slice(1);
      const ele = await dem(tail);
      line = line.concat(tail.map((p, i) => [p[0], p[1], ele[i]] as Pt3));
      approx = true;
    }
    pts = withDistance(line);
  } else {
    const dense = withDistance(thin(densify(spec.via as LatLng[], 150), 600));
    const ele = await dem(dense.map((p) => [p[0], p[1]] as LatLng));
    pts = dense.map((p, i) => [p[0], p[1], ele[i], p[3]] as Pt4);
    approx = true;
  }
  if (spec.out_and_back) pts = mirror(pts);
  return { pts, approx };
}

// ─── Wikidata links ────────────────────────────────────────────────────────────────────────────

interface WikidataLinks {
  wikipedia: string | null;
  peakbagger: string | null;
  summitpost: string | null;
  mountainproject: string | null;
  website: string | null;
  osmRelation: number | null;
}

interface WdEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
  sitelinks?: { enwiki?: { title: string } };
}

async function buildWikidata(qids: string[]): Promise<Record<string, WikidataLinks>> {
  const out: Record<string, WikidataLinks> = {};
  for (let i = 0; i < qids.length; i += 50) {
    const ids = qids.slice(i, i + 50).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=enwiki&ids=${ids}`;
    const j = JSON.parse(await fetchText(url)) as { entities: Record<string, WdEntity> };
    await sleep(1000);
    for (const [qid, ent] of Object.entries(j.entities)) {
      const first = (p: string): unknown => ent.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
      const title = ent.sitelinks?.enwiki?.title;
      const site = first('P856');
      const osm = first('P402');
      out[qid] = {
        wikipedia: title
          ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':')}`
          : null,
        peakbagger: first('P3109') ? `https://www.peakbagger.com/peak.aspx?pid=${first('P3109')}` : null,
        summitpost: first('P3309') ? `https://www.summitpost.org/page/${first('P3309')}` : null,
        mountainproject: first('P4592') ? `https://www.mountainproject.com/v/${first('P4592')}` : null,
        website: typeof site === 'string' && site.startsWith('https://') ? site : null,
        osmRelation: osm != null && Number.isFinite(Number(osm)) ? Number(osm) : null,
      };
    }
  }
  return out;
}

// ─── Main ──────────────────────────────────────────────────────────────────────────────────────

const round = Math.round;
const mi = (m: number) => (m / 1609.344).toFixed(1);
const ft = (m: number) => round(m * 3.28084);

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyArg = args.indexOf('--only');
  const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;

  fs.mkdirSync(ROUTES_DIR, { recursive: true });

  interface Obj {
    slug: string;
    data: Record<string, unknown>;
  }
  const objs: Obj[] = fs
    .readdirSync(OBJECTIVES_DIR)
    .filter(isCompanionFile)
    .map((f) => ({ slug: f.replace(/\.md$/, ''), data: matter(fs.readFileSync(path.join(OBJECTIVES_DIR, f), 'utf8')).data }));

  const invalid = objs.flatMap((o) => validateObjectiveFrontmatter(o.data, `${o.slug}.md`));
  if (invalid.length) {
    console.error(invalid.join('\n'));
    process.exit(1);
  }

  // Wikidata links first (cheap), for every QID.
  const qids = [...new Set(objs.map((o) => o.data.wikidata).filter((q): q is string => typeof q === 'string'))].sort();
  fs.writeFileSync(WIKIDATA_FILE, JSON.stringify(await buildWikidata(qids), null, 1) + '\n');
  console.log(`wikidata: ${qids.length} QIDs -> ${path.relative(ROOT, WIKIDATA_FILE)}`);

  const buildable = objs.filter(
    (o) => o.data.route && (o.data.route as RouteSpec).kind !== 'none' && o.data.completed_by === undefined,
  );
  const keep = new Set(buildable.map((o) => `${o.slug}.json`));
  for (const f of fs.readdirSync(ROUTES_DIR)) if (!keep.has(f)) fs.unlinkSync(path.join(ROUTES_DIR, f));

  const failures: string[] = [];
  const lines: string[] = [];
  for (const o of buildable) {
    if (only && !only.has(o.slug)) continue;
    const spec = o.data.route as RouteSpec;
    const specHash = crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex');
    const file = path.join(ROUTES_DIR, `${o.slug}.json`);
    if (!force && fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).specHash === specHash) continue;
    try {
      const built = await resolve(spec);
      if (!built) continue;
      const st = routeStats(built.pts);
      fs.writeFileSync(
        file,
        JSON.stringify({
          slug: o.slug,
          specHash,
          kind: spec.kind,
          approx: built.approx,
          distanceMeters: round(st.dist),
          gainMeters: round(st.gain),
          highMeters: round(st.hi),
          track: buildTrack(built.pts),
        }) + '\n',
      );
      lines.push(
        `${o.slug}\t${spec.kind}\t${mi(st.dist)} mi ${ft(st.gain)} ft (listed: ${o.data.distance_mi ?? '?'} mi / ${o.data.gain_ft ?? '?'} ft)${built.approx ? ' APPROX' : ''}`,
      );
      console.log(lines[lines.length - 1]);
    } catch (e) {
      failures.push(`${o.slug}: ${(e as Error).message}`);
      console.error(`FAILED ${o.slug}: ${(e as Error).message}`);
    }
  }
  console.log(`\n${lines.length} built, ${failures.length} failed`);
  if (failures.length) {
    console.error('\nFailures:\n' + failures.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
