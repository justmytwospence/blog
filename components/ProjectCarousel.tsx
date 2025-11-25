'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Link from 'next/link';
import type { Project } from '@/lib/types';

interface ProjectCarouselProps {
  projects: Project[];
}

export function ProjectCarousel({ projects }: ProjectCarouselProps) {
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

  // Calculate card width based on number of items and breakpoints
  const getCardWidthClass = () => {
    const count = projects.length;
    if (count === 1) return 'w-full';
    if (count === 2) return 'w-full sm:w-[calc(50%-12px)]';
    // 3 or more items - use all breakpoints up to 3 columns
    return 'w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)]';
  };

  return (
    <div className="relative px-0 sm:px-12">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6">
          {projects.map((project) => {
            const href = project.externalUrl || `/projects/${project.slug}`;
            const isExternal = !!project.externalUrl;
            
            return (
            <div
              key={project.slug}
              className={`flex-[0_0_auto] ${getCardWidthClass()}`}
            >
              <Link
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="block p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031] h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {project.type}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
                    {new Date(project.date).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4]">
                  {project.title}
                  {isExternal && (
                    <svg className="inline-block ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </h3>
                {project.description && (
                  <p className="text-gray-600 dark:text-[#cccccc] mb-3">
                    {project.description}
                  </p>
                )}
                {project.categories && project.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
