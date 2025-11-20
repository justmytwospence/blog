'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Link from 'next/link';
import type { BlogPost } from '@/lib/types';

interface BlogCarouselProps {
  posts: BlogPost[];
}

export function BlogCarousel({ posts }: BlogCarouselProps) {
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
    const count = posts.length;
    if (count === 1) return 'w-full';
    if (count === 2) return 'w-full sm:w-[calc(50%-12px)]';
    if (count === 3) return 'w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)]';
    // 4 or more items - use all breakpoints up to 4 columns
    return 'w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]';
  };

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6">
          {posts.map((post) => (
            <div
              key={post.slug}
              className={`flex-[0_0_auto] ${getCardWidthClass()}`}
            >
              <Link
                href={`/blog/${post.slug}`}
                className="block p-6 bg-white dark:bg-[#252526] rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-[#303031] h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {new Date(post.date).toLocaleDateString()}
                  </span>
                  {post.readingTime && (
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      · {post.readingTime} min read
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4]">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="text-gray-600 dark:text-[#cccccc] mb-3">
                    {post.description}
                  </p>
                )}
                {post.categories && post.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.categories.map((category) => (
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
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      <button
        onClick={scrollPrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white dark:bg-[#252526] text-gray-800 dark:text-[#d4d4d4] p-3 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors z-10"
        aria-label="Previous slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white dark:bg-[#252526] text-gray-800 dark:text-[#d4d4d4] p-3 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-[#3a3d41] transition-colors z-10"
        aria-label="Next slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
