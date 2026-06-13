'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OPENTOPO_URL, OPENTOPO_ATTRIBUTION, OPENTOPO_MAX_ZOOM } from './mapStyle';
import { ResizeHandler } from './leafletShared';
import { REGION_CENTROIDS, regionName } from './regionCentroids';
import type { Objective } from '@/lib/adventures';

type LatLng = [number, number];

export function ObjectivesMapInner({
  objectives,
  onRegionClick,
}: {
  objectives: Objective[];
  onRegionClick?: (code: string) => void;
}) {
  const markers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of objectives) {
      if (o.location && REGION_CENTROIDS[o.location]) {
        counts.set(o.location, (counts.get(o.location) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([code, count]) => ({
      code,
      count,
      center: REGION_CENTROIDS[code] as LatLng,
    }));
  }, [objectives]);

  const bounds = markers.length ? L.latLngBounds(markers.map((m) => m.center)) : null;
  const mapProps = bounds
    ? { bounds, boundsOptions: { padding: [40, 40] as LatLng } }
    : { center: [44, -110] as LatLng, zoom: 4 };

  return (
    <MapContainer scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} className="h-full w-full" {...mapProps}>
      <TileLayer url={OPENTOPO_URL} attribution={OPENTOPO_ATTRIBUTION} maxZoom={OPENTOPO_MAX_ZOOM} />
      <ResizeHandler />
      {markers.map((m) => (
        <CircleMarker
          key={m.code}
          center={m.center}
          radius={Math.min(10 + m.count * 1.6, 30)}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 0.7 }}
          eventHandlers={{ click: () => onRegionClick?.(m.code) }}
        >
          <Tooltip direction="top">
            {regionName(m.code)}: {m.count}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
