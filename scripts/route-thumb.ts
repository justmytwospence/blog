/**
 * Render a committed static map thumbnail for a route: Esri World Topo tiles stitched together
 * with the route drawn on top, cropped to the route and resized. Keeps the build offline (the
 * card just loads a local image) while giving the route real basemap context.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const TILE = 256;
const OUT_W = 600;
const OUT_H = 300;
const ASPECT = OUT_W / OUT_H;
const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;

const lon2tileX = (lon: number, z: number): number => ((lon + 180) / 360) * 2 ** z;
const lat2tileY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

/** Largest zoom at which the route's bbox fits within maxTiles × maxTiles (leaving room to expand). */
function pickZoom(minLat: number, maxLat: number, minLng: number, maxLng: number, maxTiles = 3): number {
  for (let z = 16; z >= 2; z--) {
    const spanX = Math.abs(lon2tileX(maxLng, z) - lon2tileX(minLng, z));
    const spanY = Math.abs(lat2tileY(maxLat, z) - lat2tileY(minLat, z));
    if (spanX <= maxTiles && spanY <= maxTiles) return z;
  }
  return 2;
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer | null> {
  try {
    const res = await fetch(TILE_URL(z, x, y));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Write a route thumbnail to `outPath`. `coords` are [lat, lng]. Returns true on success.
 * Best-effort: returns false (without throwing) if tiles can't be fetched.
 */
export async function buildRouteThumb(
  coordsOrTracks: Array<[number, number]> | Array<Array<[number, number]>>,
  outPath: string,
  color = '#dc2626',
): Promise<boolean> {
  // Accept a single track or several (each drawn separately — no connecting lines between them).
  const tracks: Array<Array<[number, number]>> =
    typeof (coordsOrTracks as Array<[number, number]>)[0]?.[0] === 'number'
      ? [coordsOrTracks as Array<[number, number]>]
      : (coordsOrTracks as Array<Array<[number, number]>>);
  const all = tracks.flat().filter((p) => Array.isArray(p) && p.length === 2);
  if (all.length < 2) return false;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of all) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const z = pickZoom(minLat, maxLat, minLng, maxLng);
  // Global tile-pixel coordinates at this zoom.
  const gx = (lng: number) => lon2tileX(lng, z) * TILE;
  const gy = (lat: number) => lat2tileY(lat, z) * TILE;

  // Route pixel bbox, then expand to the output aspect (centered) with margin — this is the crop box.
  const minGX = gx(minLng);
  const maxGX = gx(maxLng);
  const minGY = gy(maxLat); // north has the smaller pixel-y
  const maxGY = gy(minLat);
  const rw = Math.max(1, maxGX - minGX);
  const rh = Math.max(1, maxGY - minGY);
  const pad = Math.max(24, 0.08 * Math.max(rw, rh));
  let x0 = minGX - pad;
  let y0 = minGY - pad;
  let x1 = maxGX + pad;
  let y1 = maxGY + pad;
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw / ch < ASPECT) {
    const ex = (ch * ASPECT - cw) / 2;
    x0 -= ex;
    x1 += ex;
  } else {
    const ey = (cw / ASPECT - ch) / 2;
    y0 -= ey;
    y1 += ey;
  }

  // Fetch every tile that covers the crop box, so the crop is always fully painted (no clamping).
  const txMin = Math.floor(x0 / TILE);
  const txMax = Math.floor((x1 - 1) / TILE);
  const tyMin = Math.floor(y0 / TILE);
  const tyMax = Math.floor((y1 - 1) / TILE);
  const originX = txMin * TILE;
  const originY = tyMin * TILE;
  const W = (txMax - txMin + 1) * TILE;
  const H = (tyMax - tyMin + 1) * TILE;

  const composites: sharp.OverlayOptions[] = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      const buf = await fetchTile(z, tx, ty);
      if (buf) composites.push({ input: buf, left: (tx - txMin) * TILE, top: (ty - tyMin) * TILE });
    }
  }
  if (composites.length === 0) return false;

  // Each track as its own SVG polyline (white casing + colored line) — never connected across tracks.
  const polys = tracks
    .map((t) => t.map(([lat, lng]) => `${(gx(lng) - originX).toFixed(1)},${(gy(lat) - originY).toFixed(1)}`).join(' '))
    .filter((p) => p.length);
  const casings = polys
    .map((pts) => `<polyline points="${pts}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join('');
  const lines = polys
    .map((pts) => `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${casings}${lines}</svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const stitched = await sharp({ create: { width: W, height: H, channels: 3, background: '#e8e8e8' } })
    .composite(composites)
    .png()
    .toBuffer();

  const left = Math.max(0, Math.round(x0 - originX));
  const top = Math.max(0, Math.round(y0 - originY));
  const width = Math.max(1, Math.min(W - left, Math.round(x1 - x0)));
  const height = Math.max(1, Math.min(H - top, Math.round(y1 - y0)));

  fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true });
  await sharp(stitched)
    .extract({ left, top, width, height })
    .resize({ width: OUT_W, height: OUT_H, fit: 'cover', position: 'center' })
    .jpeg({ quality: 80, progressive: true })
    .toFile(outPath);
  return true;
}
