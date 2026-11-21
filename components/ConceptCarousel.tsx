'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { CarouselArrows } from '@/components/CarouselArrows';
import { carouselLayout } from '@/lib/carousel';
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
  const layout = carouselLayout(concepts.length, 3);

  return (
    <div className={`relative ${layout.frame}`}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-6">
          {concepts.map((concept) => (
            <div
              key={concept.slug}
              className={`flex-[0_0_auto] pl-6 ${layout.slide}`}
            >
              <ConceptCard concept={concept} />
            </div>
          ))}
        </div>
      </div>

      <CarouselArrows onPrev={scrollPrev} onNext={scrollNext} className={layout.arrows} />
    </div>
  );
}
