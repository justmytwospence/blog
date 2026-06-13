import { ImageResponse } from 'next/og';
import { getAllAdventures, getAdventureBySlug } from '@/lib/adventures';
import { formatDistance, formatElevation, formatDuration } from '@/lib/units';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllAdventures().map((a) => ({ slug: a.slug }));
}

/** Normalize a [lng,lat] track into an SVG polyline (y inverted so north is up). */
function routeSvg(coords: Array<[number, number]>): string | null {
  if (!coords || coords.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minX) minX = lng;
    if (lng > maxX) maxX = lng;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  const W = 1000;
  const H = 300;
  const pad = 16;
  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;
  const scale = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const ox = (W - sx * scale) / 2;
  const oy = (H - sy * scale) / 2;
  const pts = coords
    .map(([lng, lat]) => `${(ox + (lng - minX) * scale).toFixed(1)},${(oy + (maxY - lat) * scale).toFixed(1)}`)
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const adventure = getAdventureBySlug(slug);

  if (!adventure) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0f1115' }} />,
      size,
    );
  }

  const stat = `${formatDistance(adventure.totals.distanceMeters)}   ·   ${formatElevation(
    adventure.totals.elevationGainMeters,
  )}   ·   ${formatDuration(adventure.totals.movingTimeSeconds)}`;
  const place = [adventure.location.city, adventure.location.state ?? adventure.location.country]
    .filter(Boolean)
    .join(', ');
  const svg = adventure.primaryActivity.track
    ? routeSvg(adventure.primaryActivity.track.coordinates)
    : null;
  const svgUri = svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0f1115',
          color: '#ffffff',
          padding: 64,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#9aa4b2' }}>
            {[adventure.sportType, place].filter(Boolean).join('   ·   ')}
          </div>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginTop: 8 }}>
            {adventure.title}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#cbd5e1', marginTop: 12 }}>{stat}</div>
        </div>
        {svgUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={svgUri} width={1000} height={300} alt="" style={{ alignSelf: 'center' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', fontSize: 24, color: '#64748b' }}>Data Spencer · Adventures</div>
      </div>
    ),
    size,
  );
}
