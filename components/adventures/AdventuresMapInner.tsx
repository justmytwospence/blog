'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { decodePolyline } from '@blog/strava';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM, sportColor } from './mapStyle';
import { formatDistance, formatElevation } from '@/lib/units';
import type { AdventureSummary } from '@/lib/adventures';

type LatLng = [number, number];

interface Route {
  item: AdventureSummary;
  color: string;
  positions: LatLng[];
  start: LatLng;
}

const startIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Refit the live map when the filtered route set (bounds) changes — react-leaflet reads `bounds` only at mount. */
function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    let settled = false;
    const fit = (): boolean => {
      const { x, y } = map.getSize();
      if (x < 50 || y < 50) return false; // container not laid out yet — fitBounds would snap to maxZoom
      map.invalidateSize();
      // Generous padding so routes get some breathing room from the viewport edges.
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 12, animate: false });
      return true;
    };
    if (fit()) return;
    // Mounted before the container had a real size (hidden tab / pre-layout) — fit as soon as it does.
    const ro = new ResizeObserver(() => {
      if (!settled && fit()) {
        settled = true;
        ro.disconnect();
      }
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, bounds]);
  return null;
}

/**
 * Frame the dense cluster of activities rather than the full coast-to-coast extent. A handful of
 * far-flung trips (PNW, California, the East Coast) would otherwise zoom the initial view out to
 * "the whole USA"; trimming the outer 5% of start points on each axis keeps the map centered on
 * where the activities actually are. Outliers stay on the map, just outside the initial viewport.
 */
function clusterBounds(routes: Route[]): L.LatLngBounds | null {
  const starts = routes.map((r) => r.start);
  if (starts.length === 0) return null;
  if (starts.length < 8) return L.latLngBounds(starts);
  const lats = starts.map((s) => s[0]).sort((a, b) => a - b);
  const lngs = starts.map((s) => s[1]).sort((a, b) => a - b);
  const at = (arr: number[], p: number) =>
    arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))];
  return L.latLngBounds([at(lats, 0.05), at(lngs, 0.05)], [at(lats, 0.95), at(lngs, 0.95)]);
}

export function AdventuresMapInner({ items }: { items: AdventureSummary[] }) {
  const routes = useMemo<Route[]>(() => {
    const out: Route[] = [];
    for (const item of items) {
      if (!item.summaryPolyline) continue;
      const positions = decodePolyline(item.summaryPolyline) as LatLng[];
      if (positions.length < 2) continue;
      out.push({ item, color: sportColor(item.sportType), positions, start: positions[0] });
    }
    return out;
  }, [items]);

  const bounds = useMemo(() => clusterBounds(routes), [routes]);

  // Start US-centered; FitBounds tightens to the actual routes once the container is laid out.
  // (Passing `bounds` at mount fits against a 0-sized container and snaps to maxZoom.)
  return (
    <MapContainer
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
      center={[39, -98] as LatLng}
      zoom={4}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <ResizeHandler />
      <FitBounds bounds={bounds} />
      {routes.map((r) => (
        <Polyline key={r.item.slug} positions={r.positions} pathOptions={{ color: r.color, weight: 3, opacity: 0.85 }}>
          <Tooltip sticky>{r.item.title}</Tooltip>
        </Polyline>
      ))}
      {routes.map((r) => (
        <Marker key={r.item.slug} position={r.start} icon={startIcon(r.color)}>
          <Popup>
            <Link href={`/adventures/${r.item.slug}`} style={{ fontWeight: 600 }}>
              {r.item.title}
            </Link>
            <div style={{ marginTop: 2, fontSize: 12, color: '#666' }}>
              {formatDistance(r.item.totals.distanceMeters)} · {formatElevation(r.item.totals.elevationGainMeters)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
