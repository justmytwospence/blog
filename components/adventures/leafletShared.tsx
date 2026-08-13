'use client';

/** Leaflet bits shared by the single-activity RouteMap and the multi-day TripMap. */
import { useEffect, useRef } from 'react';
import { CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useHoverStore } from './hoverStore';
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

// ─── Hover linking (map <-> elevation chart) ───────────────────────

export type LatLng = [number, number];

/**
 * One day's drawn track, in the order the hover store indexes it. A single-activity map passes a
 * single source with `day: 0`; the trip map passes one per day that has a track, carrying the real
 * day index (days without coordinates are skipped, so position in the array is not the day).
 */
export interface HoverSource {
  day: number;
  latlngs: LatLng[];
}

/** Cursor has to land within this many CSS pixels of the track to register as hovering it. */
const SNAP_PX = 22;

/** How often the nearest-point search may run, in ms. Leaflet fires mousemove far faster than this. */
const THROTTLE_MS = 30;

/**
 * Map mousemove -> nearest track point -> hover store (drives the chart cursor).
 *
 * Snapping is measured in SCREEN pixels, not metres. A fixed metre radius is meaningless across
 * these two maps: it is generous on a single summit fit to the viewport and smaller than one pixel
 * on a thru-hike zoomed out to a whole state, where it would never register at all.
 *
 * The search itself compares squared degrees (longitude scaled by cos(lat) so the two axes are
 * commensurate) rather than true distances — a multi-week trip is tens of thousands of points, and
 * running geodesic trig over all of them on every mousemove is not affordable. Only the winner is
 * projected to screen space to apply the threshold.
 */
export function HoverTracker({ sources }: { sources: HoverSource[] }) {
  const setHover = useHoverStore((s) => s.setHover);
  const lastRun = useRef(0);

  const map = useMapEvents({
    mousemove(e) {
      // The event's own timestamp, rather than a performance.now() call — same clock, and it keeps
      // this handler free of the impure call the React Compiler lint rule (rightly) watches for.
      const now = e.originalEvent.timeStamp;
      if (now - lastRun.current < THROTTLE_MS) return;
      lastRun.current = now;

      const { lat, lng } = e.latlng;
      const kx = Math.cos((lat * Math.PI) / 180);
      let best: { day: number; index: number; latlng: LatLng } | null = null;
      let bestD2 = Infinity;
      for (const src of sources) {
        for (let i = 0; i < src.latlngs.length; i++) {
          const dy = src.latlngs[i][0] - lat;
          const dx = (src.latlngs[i][1] - lng) * kx;
          const d2 = dy * dy + dx * dx;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = { day: src.day, index: i, latlng: src.latlngs[i] };
          }
        }
      }
      if (!best) {
        setHover(null);
        return;
      }
      const cursor = map.latLngToContainerPoint(e.latlng);
      const point = map.latLngToContainerPoint(L.latLng(best.latlng[0], best.latlng[1]));
      setHover(cursor.distanceTo(point) <= SNAP_PX ? { day: best.day, index: best.index } : null);
    },
    mouseout() {
      setHover(null);
    },
  });

  return null;
}

/** Blue dot on the track at the shared hover point (driven by either map or chart). */
export function HoverMarker({ sources }: { sources: HoverSource[] }) {
  const hover = useHoverStore((s) => s.hover);
  if (!hover) return null;
  const latlng = sources.find((s) => s.day === hover.day)?.latlngs[hover.index];
  if (!latlng) return null;
  return (
    <CircleMarker
      center={latlng}
      radius={6}
      pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
    />
  );
}
