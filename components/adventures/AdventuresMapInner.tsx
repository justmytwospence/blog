'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { decodePolyline } from '@blog/strava';
import { OPENTOPO_URL, OPENTOPO_ATTRIBUTION, OPENTOPO_MAX_ZOOM, sportColor } from './mapStyle';
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
    map.invalidateSize();
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
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

  const bounds = useMemo(() => {
    const all = routes.flatMap((r) => r.positions);
    return all.length ? L.latLngBounds(all) : null;
  }, [routes]);

  const mapProps = bounds
    ? { bounds, boundsOptions: { padding: [24, 24] as [number, number] } }
    : { center: [39, -98] as LatLng, zoom: 3 };

  return (
    <MapContainer scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} className="h-full w-full" {...mapProps}>
      <TileLayer url={OPENTOPO_URL} attribution={OPENTOPO_ATTRIBUTION} maxZoom={OPENTOPO_MAX_ZOOM} />
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
