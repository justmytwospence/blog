'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM, dayColor } from './mapStyle';
import {
  ResizeHandler,
  dotIcon,
  PhotoPins,
  HoverTracker,
  HoverMarker,
  type HoverSource,
  type LatLng,
} from './leafletShared';
import type { AdventureDay, ResolvedPhoto } from '@/lib/adventures';

export function TripMapInner({ days, photos = [] }: { days: AdventureDay[]; photos?: ResolvedPhoto[] }) {
  // `day` is the index into `days`, kept explicitly: days without a track are skipped, so a line's
  // position in this array is not its day — and the hover store addresses points by day.
  const dayLines = useMemo(() => {
    const out: Array<{ day: number; color: string; positions: LatLng[] }> = [];
    days.forEach((d, i) => {
      const t = d.activity.track;
      if (!t || t.coordinates.length < 2) return;
      out.push({
        day: i,
        color: dayColor(i),
        positions: t.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      });
    });
    return out;
  }, [days]);

  const hoverSources = useMemo<HoverSource[]>(
    () => dayLines.map((d) => ({ day: d.day, latlngs: d.positions })),
    [dayLines],
  );

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
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <ResizeHandler />
      <HoverTracker sources={hoverSources} />
      {dayLines.map((d) => (
        <Polyline key={d.day} positions={d.positions} pathOptions={{ color: d.color, weight: 4, opacity: 0.9 }} />
      ))}
      <Marker position={start} icon={dotIcon('#16a34a')} />
      <Marker position={end} icon={dotIcon('#dc2626')} />
      <PhotoPins photos={photos} />
      <HoverMarker sources={hoverSources} />
    </MapContainer>
  );
}
