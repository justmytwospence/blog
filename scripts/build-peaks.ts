/**
 * Build the committed Colorado peaks dataset for the /concepts/colorado-peaks viz.
 *
 * Parses the committed Lists of John HTML exports in data/peaks-raw/ (CO 14er/13er/12er bands at a
 * uniform 100 ft prominence floor — low enough to include the famous unranked subpeaks like Mount
 * Cameron / El Diente / Conundrum) into a normalized, deterministic data/colorado-peaks.json.
 *
 * Source: Lists of John (listsofjohn.com), the canonical prominence dataset, built on USGS LiDAR
 * elevations and the reference implementation of the 300-ft rule. Fetched once and committed so the
 * site build is offline/reproducible. Re-run with `npm run peaks:build`.
 *
 * "Ranked" is NOT taken from the source — it is exactly `prominenceFt >= 300`, the rule the post
 * lets the reader move.
 */
import fs from 'fs';
import path from 'path';

const RAW_DIR = path.join(process.cwd(), 'data', 'peaks-raw');
// Served as a static asset and fetched client-side by the viz (the component is ssr:false, so there
// is no benefit to embedding it in the prerendered HTML — fetching keeps the page payload small).
const OUT = path.join(process.cwd(), 'public', 'colorado-peaks.json');
const FILES = ['loj-co-14ers-p100.html', 'loj-co-13ers-p100.html', 'loj-co-12ers-p100.html'];

export interface Peak {
  name: string;
  elevationFt: number;
  prominenceFt: number;
  county?: string;
  ydsClass?: string;
  /** Lists of John peak id — links to listsofjohn.com/peak/<id>, the authoritative per-peak page. */
  lojId?: number;
  /** false when Lists of John brackets the name in quotes (an unofficial/informal name). */
  official: boolean;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFeet(cell: string): number {
  return parseInt(stripTags(cell).replace(/[,'"]/g, ''), 10);
}

/** "Elbert, Mount" -> "Mount Elbert"; strips the LoJ quotes that mark unofficial names. */
function normalizeName(cell: string): { name: string; official: boolean } {
  let s = stripTags(cell);
  const official = !s.startsWith('"');
  s = s.replace(/^"|"$/g, '').trim();
  const m = s.match(/^(.+),\s+(Mount|Mountain|Peak|Point)$/);
  if (m) s = `${m[2]} ${m[1]}`;
  return { name: s, official };
}

function parseFile(html: string): Peak[] {
  const peaks: Peak[] = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    if (/class="one"/i.test(row)) continue; // header row
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [];
    // cols: 0 listRank, 1 name, 2 coRank, 3 elev, 4 prom, 5 isolation, 6 county, 7 quad, ...10 YDS
    if (cells.length < 7) continue;
    const elevationFt = toFeet(cells[3]);
    const prominenceFt = toFeet(cells[4]);
    if (!Number.isFinite(elevationFt) || !Number.isFinite(prominenceFt)) continue;
    const { name, official } = normalizeName(cells[1]);
    if (!name) continue;
    const idMatch = cells[1].match(/\/peak\/(\d+)/);
    const lojId = idMatch ? Number(idMatch[1]) : undefined;
    const county = stripTags(cells[6]) || undefined;
    const yds = cells[10] ? stripTags(cells[10]) : undefined;
    peaks.push({ name, elevationFt, prominenceFt, county, ydsClass: yds || undefined, lojId, official });
  }
  return peaks;
}

function main(): void {
  const all: Peak[] = [];
  for (const f of FILES) {
    const html = fs.readFileSync(path.join(RAW_DIR, f), 'utf8');
    const got = parseFile(html);
    console.log(`${f}: ${got.length} peaks`);
    all.push(...got);
  }

  // De-dupe (bands don't overlap, but guard) and sort by elevation desc, prominence desc.
  const seen = new Set<string>();
  const peaks = all
    .filter((p) => {
      const k = `${p.name}@${p.elevationFt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.elevationFt - a.elevationFt || b.prominenceFt - a.prominenceFt);

  fs.writeFileSync(OUT, JSON.stringify(peaks) + '\n');

  const ranked14 = peaks.filter((p) => p.elevationFt >= 14000 && p.prominenceFt >= 300).length;
  const all14 = peaks.filter((p) => p.elevationFt >= 14000).length;
  console.log(
    `wrote ${peaks.length} peaks -> public/colorado-peaks.json | 14k+ ranked(≥300'): ${ranked14}, 14k+ total: ${all14}`,
  );
}

main();
