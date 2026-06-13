/**
 * Render a committed static map thumbnail for a route: Esri World Topo tiles stitched together
 * with the route drawn on top, cropped to the route and resized. Keeps the build offline (the
 * card just loads a local image) while giving the route real basemap context.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;

const lon2tileX = (lon: number, z: number): number => ((lon + 180) / 360) * 2 ** z;
const lat2tileY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

/** Largest zoom at which the route's bounding box still fits within maxTiles × maxTiles. */
function pickZoom(coords: Array<[number, number]>, maxTiles = 4): number {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  for (let z = 16; z >= 3; z--) {
    const spanX = Math.abs(lon2tileX(maxLng, z) - lon2tileX(minLng, z));
    const spanY = Math.abs(lat2tileY(maxLat, z) - lat2tileY(minLat, z));
    if (Math.ceil(spanX) + 1 <= maxTiles && Math.ceil(spanY) + 1 <= maxTiles) return z;
  }
  return 3;
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
  coords: Array<[number, number]>,
  outPath: string,
  color = '#dc2626',
): Promise<boolean> {
  if (!coords || coords.length < 2) return false;
  const z = pickZoom(coords);

  const txs = coords.map(([, lng]) => lon2tileX(lng, z));
  const tys = coords.map(([lat]) => lat2tileY(lat, z));
  const xMin = Math.floor(Math.min(...txs));
  const xMax = Math.floor(Math.max(...txs));
  const yMin = Math.floor(Math.min(...tys));
  const yMax = Math.floor(Math.max(...tys));
  const cols = xMax - xMin + 1;
  const rows = yMax - yMin + 1;
  const W = cols * TILE;
  const H = rows * TILE;

  // Fetch every covering tile.
  const composites: sharp.OverlayOptions[] = [];
  for (let tx = xMin; tx <= xMax; tx++) {
    for (let ty = yMin; ty <= yMax; ty++) {
      const buf = await fetchTile(z, tx, ty);
      if (buf) composites.push({ input: buf, left: (tx - xMin) * TILE, top: (ty - yMin) * TILE });
    }
  }
  if (composites.length === 0) return false;

  // Route as an SVG overlay in stitched-image pixel space (white casing + colored line).
  const pts = coords
    .map(([lat, lng]) => `${((lon2tileX(lng, z) - xMin) * TILE).toFixed(1)},${((lat2tileY(lat, z) - yMin) * TILE).toFixed(1)}`)
    .join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const stitched = await sharp({ create: { width: W, height: H, channels: 3, background: '#e8e8e8' } })
    .composite(composites)
    .png()
    .toBuffer();

  // Crop to the route's pixel bbox, expanded to the card's aspect (centered) so the WHOLE route
  // is visible with even margin and the later object-cover doesn't clip it.
  const OUT_W = 600;
  const OUT_H = 300;
  const ASPECT = OUT_W / OUT_H;
  const pxs = txs.map((t) => (t - xMin) * TILE);
  const pys = tys.map((t) => (t - yMin) * TILE);
  const minPx = Math.min(...pxs);
  const maxPx = Math.max(...pxs);
  const minPy = Math.min(...pys);
  const maxPy = Math.max(...pys);
  const rw = Math.max(1, maxPx - minPx);
  const rh = Math.max(1, maxPy - minPy);
  const pad = Math.max(24, 0.08 * Math.max(rw, rh));
  let x0 = minPx - pad;
  let y0 = minPy - pad;
  let x1 = maxPx + pad;
  let y1 = maxPy + pad;
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
  const left = Math.max(0, Math.round(x0));
  const top = Math.max(0, Math.round(y0));
  const width = Math.max(1, Math.min(W - left, Math.round(x1) - left));
  const height = Math.max(1, Math.min(H - top, Math.round(y1) - top));

  fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true });
  await sharp(stitched)
    .extract({ left, top, width, height })
    .resize({ width: OUT_W, height: OUT_H, fit: 'cover', position: 'center' })
    .jpeg({ quality: 80, progressive: true })
    .toFile(outPath);
  return true;
}
