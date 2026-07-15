'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Concept } from '@/lib/types';
import { ConceptCard } from './ConceptCard';

interface ConceptCarouselProps {
  concepts: Concept[];
}

export function ConceptCarousel({ concepts }: ConceptCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      slidesToScroll: 1,
    },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Spacing lives INSIDE each slide (pl-6 + negative track margin), not in a
  // flex gap: embla's loop translates slides individually, and a gap stays
  // glued to DOM order, so gutters collapse after the loop wraps.
  const getCardWidthClass = () => {
    const count = concepts.length;
    if (count === 1) return 'w-full';
    if (count === 2) return 'w-full sm:w-1/2';
    return 'w-full sm:w-1/2 md:w-1/3';
  };

  return (
    <div className="relative px-0 sm:px-12">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-6">
          {concepts.map((concept) => (
            <div
              key={concept.slug}
              className={`flex-[0_0_auto] pl-6 ${getCardWidthClass()}`}
            >
              <ConceptCard concept={concept} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons - hidden on mobile */}
      <button
        onClick={scrollPrev}
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white dark:bg-[#252526] text-gray-800 dark:text-[#d4d4d4] p-3 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors z-10 cursor-pointer"
        aria-label="Previous slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={scrollNext}
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white dark:bg-[#252526] text-gray-800 dark:text-[#d4d4d4] p-3 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors z-10 cursor-pointer"
        aria-label="Next slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
