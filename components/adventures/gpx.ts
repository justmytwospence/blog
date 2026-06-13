/**
 * Build GPX 1.1 documents from stored tracks, client-side (Download GPX buttons).
 * Strava has no activity GPX export, so we reconstruct from decoded lng/lat + altitude.
 */
import type { AdventureTrack } from '@/lib/adventures';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trkseg(track: AdventureTrack): string {
  const pts = track.coordinates
    .map(([lng, lat], i) => {
      const ele = track.altitude[i];
      const eleTag = ele != null && Number.isFinite(ele) ? `<ele>${ele.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');
  return `    <trkseg>\n${pts}\n    </trkseg>`;
}

function gpxDoc(name: string, segments: AdventureTrack[]): string {
  const segs = segments.map(trkseg).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="adventures" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
${segs}
  </trk>
</gpx>`;
}

function triggerDownload(content: string, name: string): void {
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'route'}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildGpx(track: AdventureTrack, name: string): string {
  return gpxDoc(name, [track]);
}

/** Multi-day GPX: one <trkseg> per day so days aren't joined by a phantom connector. */
export function buildGpxMulti(tracks: AdventureTrack[], name: string): string {
  return gpxDoc(name, tracks);
}

export function downloadGpx(track: AdventureTrack, name: string): void {
  triggerDownload(buildGpx(track, name), name);
}

export function downloadGpxMulti(tracks: AdventureTrack[], name: string): void {
  triggerDownload(buildGpxMulti(tracks, name), name);
}
