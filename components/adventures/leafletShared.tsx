'use client';

/** Leaflet bits shared by the single-activity RouteMap and the multi-day TripMap. */
import { useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ResolvedPhoto } from '@/lib/adventures';

/** Keep Leaflet sized when its container resizes (mobile rotate, fullscreen). Does not move the view. */
export function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const photoIcon = L.divIcon({
  className: '',
  html: `<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;background:#1e293b;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);color:#fff;font-size:10px">▣</span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Geotagged photo pins with a thumbnail popup. */
export function PhotoPins({ photos }: { photos: ResolvedPhoto[] }) {
  const pins = photos.filter(
    (p): p is ResolvedPhoto & { lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  return (
    <>
      {pins.map((p) => (
        <Marker key={p.src} position={[p.lat, p.lng]} icon={photoIcon}>
          <Popup>
            <a href={p.src} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt={p.caption ?? ''} style={{ width: 160, height: 'auto', borderRadius: 6, display: 'block' }} />
            </a>
            {p.caption && <div style={{ marginTop: 4, fontSize: 12 }}>{p.caption}</div>}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
