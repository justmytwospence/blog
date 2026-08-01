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

// Colorado's bounding box — the initial frame and the fallback when nothing qualifies.
const CO_BOUNDS: [[number, number], [number, number]] = [
  [36.992, -109.06],
  [41.003, -102.041],
];

const DOT = '#334155'; // neutral dark slate — every shown peak passes both thresholds

/** Live-fit the view to the currently-shown peaks (with a buffer); falls back to all of Colorado. */
function FitToPeaks({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    const target = bounds ?? CO_BOUNDS;
    const fit = () => {
      const { x, y } = map.getSize();
      if (x < 50 || y < 50) return false;
      map.invalidateSize();
      map.fitBounds(target, { padding: [36, 36], maxZoom: 11, animate: false });
      return true;
    };
    if (fit()) return;
    const ro = new ResizeObserver(() => {
      if (fit()) ro.disconnect();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, bounds]);
  return null;
}

/**
 * Spatial companion to the CDF: only the peaks that pass BOTH thresholds (elevation + prominence),
 * as neutral dots linked to their 14ers.com page. The view zooms live to fit the selected peaks.
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
    () =>
      peaks.filter(
        (p) =>
          p.lat != null &&
          p.lon != null &&
          p.elevationFt >= elevationThreshold &&
          p.prominenceFt >= prominenceCutoff,
      ),
    [peaks, elevationThreshold, prominenceCutoff],
  );

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!shown.length) return null;
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const p of shown) {
      const la = p.lat as number;
      const lo = p.lon as number;
      if (la < minLat) minLat = la;
      if (la > maxLat) maxLat = la;
      if (lo < minLon) minLon = lo;
      if (lo > maxLon) maxLon = lo;
    }
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }, [shown]);

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
      <FitToPeaks bounds={bounds} />
      {shown.map((p) => (
        <CircleMarker
          key={`${p.name}-${p.elevationFt}`}
          center={[p.lat as number, p.lon as number]}
          radius={4}
          pathOptions={{ color: DOT, fillColor: DOT, fillOpacity: 0.45, weight: 0.75, opacity: 0.7 }}
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
              {nf.format(p.elevationFt)}′ · {nf.format(p.prominenceFt)}′ prom
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
