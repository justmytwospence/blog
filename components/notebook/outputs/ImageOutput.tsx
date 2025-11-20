/**
 * Image Output Renderer
 * 
 * Handles image/png, image/jpeg, and image/svg+xml MIME types.
 * Supports Quarto figure options including captions, alt text, and dimensions.
 * Includes PhotoSwipe lightbox for fullscreen viewing with pan and zoom.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import type { QuartoCellOptions } from '@/lib/notebook/types';

interface ImageOutputProps {
  data: Record<string, any>;
  cellOptions?: QuartoCellOptions;
  cellIndex?: number;
  outputIndex?: number;
}

/**
 * ImageOutput component
 * 
 * Renders image outputs with support for:
 * - Multiple image formats (PNG, JPEG, SVG)
 * - Figure captions (fig-cap)
 * - Alt text (fig-alt)
 * - Custom dimensions (fig-width, fig-height)
 * - Responsive scaling
 * - Fullscreen viewing with PhotoSwipe (pan and zoom)
 */
export function ImageOutput({ data, cellOptions = {}, cellIndex = 0, outputIndex = 0 }: ImageOutputProps) {
  // Use deterministic ID based on cell and output indices to avoid hydration mismatch
  const galleryId = `image-gallery-${cellIndex}-${outputIndex}`;
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  // Determine which image format to use (priority: SVG > PNG > JPEG)
  let imageData: string | null = null;
  let mimeType: string | null = null;

  if (data['image/svg+xml']) {
    imageData = data['image/svg+xml'];
    mimeType = 'image/svg+xml';
  } else if (data['image/png']) {
    imageData = data['image/png'];
    mimeType = 'image/png';
  } else if (data['image/jpeg']) {
    imageData = data['image/jpeg'];
    mimeType = 'image/jpeg';
  }

  // Extract figure options
  const caption = cellOptions['fig-cap'];
  const altText = cellOptions['fig-alt'] || caption || 'Figure output';
  const figWidth = cellOptions['fig-width'];
  const figHeight = cellOptions['fig-height'];

  // Build style object for dimensions
  const imageStyle: React.CSSProperties = {};
  if (figWidth) {
    imageStyle.width = typeof figWidth === 'number' ? `${figWidth}px` : figWidth;
  }
  if (figHeight) {
    imageStyle.height = typeof figHeight === 'number' ? `${figHeight}px` : figHeight;
  }

  // Initialize PhotoSwipe for raster images (not SVG)
  useEffect(() => {
    if (!imageData || mimeType === 'image/svg+xml') {
      return;
    }

    lightboxRef.current = new PhotoSwipeLightbox({
      gallery: `#${galleryId}`,
      children: 'a',
      pswpModule: () => import('photoswipe'),
      // Enable pan and zoom
      zoom: true,
      loop: false,
      closeOnVerticalDrag: true,
      pinchToClose: true,
      // Styling
      bgOpacity: 0.95,
      padding: { top: 40, bottom: 40, left: 20, right: 20 },
    });

    lightboxRef.current.init();

    return () => {
      if (lightboxRef.current) {
        lightboxRef.current.destroy();
        lightboxRef.current = null;
      }
    };
  }, [imageData, mimeType]);

  if (!imageData) {
    return null;
  }

  // For SVG, render directly (no lightbox)
  if (mimeType === 'image/svg+xml') {
    return (
      <figure className="notebook-image-output my-4">
        <div 
          className="svg-container max-w-full overflow-auto"
          style={imageStyle}
          dangerouslySetInnerHTML={{ __html: imageData }}
        />
        {caption && (
          <figcaption className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // For PNG and JPEG, use base64 data URLs with PhotoSwipe
  const src = `data:${mimeType};base64,${imageData}`;

  return (
    <figure className="notebook-image-output my-4">
      <div id={galleryId}>
        <a
          href={src}
          data-pswp-width="1200"
          data-pswp-height="800"
          target="_blank"
          rel="noreferrer"
          className="block cursor-zoom-in"
        >
          <img
            src={src}
            alt={altText}
            style={imageStyle}
            className="max-w-full h-auto hover:opacity-90 transition-opacity"
          />
        </a>
      </div>
      {caption && (
        <figcaption className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
