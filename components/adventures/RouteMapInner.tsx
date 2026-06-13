'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  OPENTOPO_URL,
  OPENTOPO_ATTRIBUTION,
  OPENTOPO_MAX_ZOOM,
  gradeColor,
  rampColor,
  type RouteColorMetric,
} from './mapStyle';
import { ResizeHandler, dotIcon, PhotoPins } from './leafletShared';
import { useHoverStore } from './hoverStore';
import type { AdventureTrack, ResolvedPhoto } from '@/lib/adventures';

type LatLng = [number, number];

/** Refit the route to the viewport only when fullscreen toggles (not on incidental reflows). */
function RefitOnToggle({ bounds, full }: { bounds: L.LatLngBounds; full: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds, full]);
  return null;
}

/** Map mousemove -> nearest track point -> hover store (drives the chart cursor). Throttled. */
function HoverTracker({ pts }: { pts: L.LatLng[] }) {
  const setHoverIndex = useHoverStore((s) => s.setHoverIndex);
  const lastRun = useRef(0);
  useMapEvents({
    mousemove(e) {
      const now = performance.now();
      if (now - lastRun.current < 30) return;
      lastRun.current = now;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = e.latlng.distanceTo(pts[i]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHoverIndex(bestDist < 250 ? best : -1);
    },
    mouseout() {
      setHoverIndex(-1);
    },
  });
  return null;
}

function HoverMarker({ latlngs }: { latlngs: LatLng[] }) {
  const i = useHoverStore((s) => s.hoverIndex);
  if (i < 0 || i >= latlngs.length) return null;
  return (
    <CircleMarker
      center={latlngs[i]}
      radius={6}
      pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
    />
  );
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
  const pts = useMemo(() => latlngs.map(([lat, lng]) => L.latLng(lat, lng)), [latlngs]);
  const bounds = useMemo(() => L.latLngBounds(latlngs), [latlngs]);

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
      <TileLayer url={OPENTOPO_URL} attribution={OPENTOPO_ATTRIBUTION} maxZoom={OPENTOPO_MAX_ZOOM} />
      <ResizeHandler />
      <RefitOnToggle bounds={bounds} full={full} />
      <HoverTracker pts={pts} />
      {runs.map((s, i) => (
        <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 4, opacity: 0.9 }} />
      ))}
      <Marker position={latlngs[0]} icon={dotIcon('#16a34a')} />
      {summit && <Marker position={summit} icon={dotIcon('#ea580c')} />}
      <PhotoPins photos={photos} />
      <HoverMarker latlngs={latlngs} />
    </MapContainer>
  );
}
