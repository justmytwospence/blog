'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { decodePolyline } from '@blog/strava';
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from '../mapStyle';
import { ResizeHandler } from '../leafletShared';
import { statsLine } from './format';
import type { CatalogItem } from '@/lib/adventures';

type LatLng = [number, number];

const DONE = '#10b981';
const TODO = '#2563eb';

/** Refit the live map when the filtered point set changes — react-leaflet reads `bounds` only at mount. */
function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    let settled = false;
    const fit = (): boolean => {
      const { x, y } = map.getSize();
      if (x < 50 || y < 50) return false; // container not laid out yet — fitBounds would snap to maxZoom
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9, animate: false });
      return true;
    };
    if (fit()) return;
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

export function CatalogMapInner({ items }: { items: CatalogItem[] }) {
  const points = useMemo(
    () => items.filter((i) => i.lat != null && i.lng != null),
    [items],
  );
  const lines = useMemo(
    () =>
      items
        .filter((i) => i.done)
        .flatMap((i) =>
          i.polylines
            .map((p) => decodePolyline(p) as LatLng[])
            .filter((seg) => seg.length >= 2)
            .map((seg, si) => ({ key: `${i.slug}-${si}`, seg })),
        ),
    [items],
  );
  const bounds = useMemo(
    () => (points.length ? L.latLngBounds(points.map((p) => [p.lat as number, p.lng as number] as LatLng)) : null),
    [points],
  );

  return (
    <MapContainer
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="h-full w-full"
      center={[42, -110] as LatLng}
      zoom={4}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
      <ResizeHandler />
      <FitBounds bounds={bounds} />
      {lines.map((l) => (
        <Polyline key={l.key} positions={l.seg} pathOptions={{ color: DONE, weight: 2.5, opacity: 0.7 }} />
      ))}
      {points.map((p) => {
        const stats = statsLine(p);
        return (
          <CircleMarker
            key={p.slug}
            center={[p.lat as number, p.lng as number]}
            radius={6}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: p.done ? DONE : TODO, fillOpacity: 0.9 }}
          >
            <Tooltip direction="top">{p.title}</Tooltip>
            <Popup>
              {p.reportSlug ? (
                <Link href={`/adventures/${p.reportSlug}`} style={{ fontWeight: 600 }}>
                  {p.title}
                </Link>
              ) : p.link ? (
                <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                  {p.title}
                </a>
              ) : (
                <strong>{p.title}</strong>
              )}
              {stats && <div style={{ marginTop: 2, fontSize: 12, color: '#666' }}>{stats}</div>}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
