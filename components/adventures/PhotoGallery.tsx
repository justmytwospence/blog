'use client';

import { useEffect, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import type { ResolvedPhoto } from '@/lib/adventures';

/**
 * Photo gallery with a PhotoSwipe lightbox (copies the working pattern from
 * components/notebook/outputs/ImageOutput.tsx). Photos are local files; real width/height
 * are passed to data-pswp-* to size the lightbox and to the thumb to avoid layout shift.
 */
export function PhotoGallery({ photos, galleryId }: { photos: ResolvedPhoto[]; galleryId: string }) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  useEffect(() => {
    const lb = new PhotoSwipeLightbox({
      gallery: `#${galleryId}`,
      children: 'a',
      pswpModule: () => import('photoswipe'),
      zoom: true,
      loop: false,
      bgOpacity: 0.95,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      padding: { top: 40, bottom: 40, left: 20, right: 20 },
    });
    lb.init();
    lightboxRef.current = lb;
    return () => {
      lightboxRef.current?.destroy();
      lightboxRef.current = null;
    };
  }, [galleryId]);

  if (photos.length === 0) return null;

  return (
    <section className="mt-8">
      <div id={galleryId} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <a
            key={p.src}
            href={p.src}
            data-pswp-width={p.width || 1600}
            data-pswp-height={p.height || 1200}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={p.caption ?? 'View photo'}
            className="block cursor-zoom-in overflow-hidden rounded-lg bg-gray-100 dark:bg-[#252526]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumb}
              alt={p.caption ?? ''}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
