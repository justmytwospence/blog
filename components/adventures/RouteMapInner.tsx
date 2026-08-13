'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  TILE_URL,
  TILE_ATTRIBUTION,
  TILE_MAX_ZOOM,
  gradeColor,
  rampColor,
  type RouteColorMetric,
} from './mapStyle';
import {
  ResizeHandler,
  dotIcon,
  PhotoPins,
  HoverTracker,
  HoverMarker,
  type HoverSource,
  type LatLng,
} from './leafletShared';
import type { AdventureTrack, ResolvedPhoto } from '@/lib/adventures';

/** Refit the route to the viewport only when fullscreen toggles (not on incidental reflows). */
function RefitOnToggle({ bounds, full }: { bounds: L.LatLngBounds; full: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds, full]);
  return null;
}

export function RouteMapInner({
  track,
  photos = [],
  colorMetric,
  full = false,
}: {
  track: AdventureTrack;
  photos?: ResolvedPhoto[];
  colorMetric: RouteColorMetric;
  full?: boolean;
}) {
  const latlngs = useMemo<LatLng[]>(
    () => track.coordinates.map(([lng, lat]) => [lat, lng]),
    [track.coordinates],
  );
  const bounds = useMemo(() => L.latLngBounds(latlngs), [latlngs]);
  // A single activity is the one-day case: the hover store always addresses points as (day, index).
  const hoverSources = useMemo<HoverSource[]>(() => [{ day: 0, latlngs }], [latlngs]);

  // Coalesce consecutive same-color segments into runs -> far fewer Leaflet layers.
  const runs = useMemo(() => {
    const n = latlngs.length;
    if (n < 2) return [] as Array<{ positions: LatLng[]; color: string }>;
    const values =
      colorMetric === 'grade' ? track.grade : colorMetric === 'speed' ? track.velocity : track.heartrate;
    const usable = Array.isArray(values) && values.length === n;
    let min = 0;
    let max = 1;
    if (usable && colorMetric !== 'grade') {
      min = Math.min(...values);
      max = Math.max(...values);
    }
    const colorAt = (i: number) =>
      usable ? (colorMetric === 'grade' ? gradeColor(values[i]) : rampColor(values[i], min, max)) : '#2563eb';
    const out: Array<{ positions: LatLng[]; color: string }> = [];
    let runColor = colorAt(0);
    let run: LatLng[] = [latlngs[0], latlngs[1]];
    for (let i = 1; i < n - 1; i++) {
      const c = colorAt(i);
      if (c === runColor) {
        run.push(latlngs[i + 1]);
      } else {
        out.push({ positions: run, color: runColor });
        runColor = c;
        run = [latlngs[i], latlngs[i + 1]];
      }
    }
    out.push({ positions: run, color: runColor });
    return out;
  }, [latlngs, track, colorMetric]);

  const summit = useMemo(() => {
    if (!track.altitude || track.altitude.length !== latlngs.length) return null;
    let bi = 0;
    let bv = -Infinity;
    track.altitude.forEach((a, i) => {
      if (a > bv) {
        bv = a;
        bi = i;
      }
    });
    return latlngs[bi];
  }, [track.altitude, latlngs]);

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
      <RefitOnToggle bounds={bounds} full={full} />
      <HoverTracker sources={hoverSources} />
      {runs.map((s, i) => (
        <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 4, opacity: 0.9 }} />
      ))}
      <Marker position={latlngs[0]} icon={dotIcon('#16a34a')} />
      {summit && <Marker position={summit} icon={dotIcon('#ea580c')} />}
      <PhotoPins photos={photos} />
      <HoverMarker sources={hoverSources} />
    </MapContainer>
  );
}
