'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { CarouselArrows } from '@/components/CarouselArrows';
import { carouselLayout, carouselOptions } from '@/lib/carousel';
import Link from 'next/link';
import type { Project } from '@/lib/types';
import { projectCardDestination } from '@/lib/project-navigation';

interface ProjectCarouselProps {
  projects: Project[];
}

export function ProjectCarousel({ projects }: ProjectCarouselProps) {
  const layout = carouselLayout(projects.length, 3);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions(projects.length),
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Spacing lives INSIDE each slide (padding inside the slide, symmetric on phones, pl-6 + negative track margin from sm), not in a
  // flex gap: embla's loop translates slides individually, and a gap stays
  // glued to DOM order, so gutters collapse after the loop wraps.

  return (
    <div className={`relative ${layout.frame}`}>
      <div className={layout.viewport} ref={emblaRef}>
        <div className={layout.track}>
          {projects.map((project) => {
            const { href, external: isExternal } = projectCardDestination(project);

            return (
            <div
              key={project.slug}
              className={`flex-[0_0_auto] ${layout.slide}`}
            >
              <Link
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="block p-6 bg-white dark:bg-[#252526] rounded-lg border border-gray-200 dark:border-[#303031] transition-colors hover:border-gray-400 dark:hover:border-[#5a5a5a] sm:h-full"
              >
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4]">
                  {project.title}
                  {isExternal && (
                    <svg className="inline-block ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </h3>
                {project.description && (
                  <p className="font-serif text-gray-600 dark:text-[#cccccc] mb-3 line-clamp-4">
                    {project.description}
                  </p>
                )}
                {project.categories && project.categories.length > 0 && (
                  <div className="flex max-h-6 flex-wrap gap-2 overflow-hidden">
                    {project.categories.map((category) => (
                      <span
                        key={category}
                        className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#3a3d41] text-gray-700 dark:text-[#cccccc]"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </div>
            );
          })}
        </div>
      </div>

      <CarouselArrows onPrev={scrollPrev} onNext={scrollNext} className={layout.arrows} />
    </div>
  );
}
