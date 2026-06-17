'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from '../adventures/mapStyle';

interface MapPeak {
  name: string;
  elevationFt: number;
  prominenceFt: number;
  lat?: number;
  lon?: number;
  coUrl?: string;
  official: boolean;
}

const nf = new Intl.NumberFormat('en-US');

// Colorado's bounding box (it's a near-rectangle): SW and NE corners.
const CO_BOUNDS: [[number, number], [number, number]] = [
  [36.992, -109.06],
  [41.003, -102.041],
];

/** Frame exactly Colorado on mount and keep it framed on resize. */
function FitColorado() {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      const { x, y } = map.getSize();
      if (x < 50 || y < 50) return; // container not laid out yet
      map.invalidateSize();
      map.fitBounds(CO_BOUNDS, { padding: [2, 2], animate: false });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * Spatial companion to the CDF: every mapped peak at or above the elevation threshold, colored
 * teal if it clears the prominence cutoff and amber if it's cut by the rule — the same in/out
 * coding as the list, linked to the same Lists of John page. Canvas-rendered for ~900 markers.
 */
export function PeaksMapInner({
  peaks,
  elevationThreshold,
  prominenceCutoff,
}: {
  peaks: MapPeak[];
  elevationThreshold: number;
  prominenceCutoff: number;
}) {
  const shown = useMemo(
    () => peaks.filter((p) => p.lat != null && p.lon != null && p.elevationFt >= elevationThreshold),
    [peaks, elevationThreshold],
  );

  return (
    <MapContainer
      preferCanvas
      scrollWheelZoom={false}
      bounds={CO_BOUNDS}
      boundsOptions={{ padding: [2, 2] }}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <FitColorado />
      {shown.map((p) => {
        const qualifies = p.prominenceFt >= prominenceCutoff;
        const color = qualifies ? '#16a34a' : '#ea580c'; // green = clears the rule, orange = cut by it
        return (
          // Include qualification in the key so a peak that flips in/out on a prominence change
          // remounts with the new color (react-leaflet won't restyle a reused marker on its own).
          <CircleMarker
            key={`${p.name}-${p.elevationFt}-${qualifies ? 'in' : 'out'}`}
            center={[p.lat as number, p.lon as number]}
            radius={qualifies ? 4 : 3.5}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.4, weight: 0.75, opacity: 0.7 }}
          >
            <Popup>
              {p.coUrl ? (
                <a
                  href={p.coUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 600, fontStyle: p.official ? 'normal' : 'italic' }}
                >
                  {p.name}
                </a>
              ) : (
                <span style={{ fontWeight: 600, fontStyle: p.official ? 'normal' : 'italic' }}>{p.name}</span>
              )}
              <div style={{ marginTop: 2, fontSize: 12, color: '#666' }}>
                {nf.format(p.elevationFt)}′ · {nf.format(p.prominenceFt)}′ prom ·{' '}
                {qualifies ? 'counts' : 'cut by the rule'}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
