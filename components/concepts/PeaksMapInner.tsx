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
  lojId?: number;
  official: boolean;
}

const nf = new Intl.NumberFormat('en-US');

/** Keep Leaflet sized when its container resizes (mirrors the adventures maps). */
function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
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
      center={[39.0, -105.6]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <ResizeHandler />
      {shown.map((p) => {
        const qualifies = p.prominenceFt >= prominenceCutoff;
        const color = qualifies ? '#0d9488' : '#d97706';
        return (
          <CircleMarker
            key={`${p.name}-${p.elevationFt}`}
            center={[p.lat as number, p.lon as number]}
            radius={qualifies ? 4 : 3.5}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
          >
            <Popup>
              <a
                href={p.lojId ? `https://listsofjohn.com/peak/${p.lojId}` : undefined}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, fontStyle: p.official ? 'normal' : 'italic' }}
              >
                {p.name}
              </a>
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
