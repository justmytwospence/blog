/**
 * Build a GPX 1.1 document from a stored track, client-side (for the Download GPX button).
 * Strava has no activity GPX export, so we reconstruct it from the decoded lng/lat + altitude.
 */
import type { AdventureTrack } from '@/lib/adventures';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildGpx(track: AdventureTrack, name: string): string {
  const pts = track.coordinates
    .map(([lng, lat], i) => {
      const ele = track.altitude[i];
      const eleTag = ele != null && Number.isFinite(ele) ? `<ele>${ele.toFixed(1)}</ele>` : '';
      return `    <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="adventures" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

/** Trigger a browser download of the GPX for a track. */
export function downloadGpx(track: AdventureTrack, name: string): void {
  const blob = new Blob([buildGpx(track, name)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'route'}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
