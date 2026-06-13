'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OPENTOPO_URL, OPENTOPO_ATTRIBUTION, OPENTOPO_MAX_ZOOM, dayColor } from './mapStyle';
import { ResizeHandler, dotIcon, PhotoPins } from './leafletShared';
import type { AdventureDay, ResolvedPhoto } from '@/lib/adventures';

type LatLng = [number, number];

export function TripMapInner({ days, photos = [] }: { days: AdventureDay[]; photos?: ResolvedPhoto[] }) {
  const dayLines = useMemo(() => {
    const out: Array<{ color: string; positions: LatLng[] }> = [];
    days.forEach((d, i) => {
      const t = d.activity.track;
      if (!t || t.coordinates.length < 2) return;
      out.push({ color: dayColor(i), positions: t.coordinates.map(([lng, lat]) => [lat, lng] as LatLng) });
    });
    return out;
  }, [days]);

  const bounds = useMemo(() => {
    const all = dayLines.flatMap((d) => d.positions);
    return all.length ? L.latLngBounds(all) : null;
  }, [dayLines]);

  if (!bounds) return null;
  const start = dayLines[0].positions[0];
  const lastLine = dayLines[dayLines.length - 1];
  const end = lastLine.positions[lastLine.positions.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [24, 24] }}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
    >
      <TileLayer url={OPENTOPO_URL} attribution={OPENTOPO_ATTRIBUTION} maxZoom={OPENTOPO_MAX_ZOOM} />
      <ResizeHandler />
      {dayLines.map((d, i) => (
        <Polyline key={i} positions={d.positions} pathOptions={{ color: d.color, weight: 4, opacity: 0.9 }} />
      ))}
      <Marker position={start} icon={dotIcon('#16a34a')} />
      <Marker position={end} icon={dotIcon('#dc2626')} />
      <PhotoPins photos={photos} />
    </MapContainer>
  );
}
