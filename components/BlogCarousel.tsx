'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { CarouselArrows } from '@/components/CarouselArrows';
import { carouselLayout } from '@/lib/carousel';
import Link from 'next/link';
import type { BlogPost } from '@/lib/types';
import { formatDate } from '@/lib/format';

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

  // Spacing lives INSIDE each slide (pl-6 + negative track margin), not in a
  // flex gap: embla's loop translates slides individually, and a gap stays
  // glued to DOM order, so gutters collapse after the loop wraps.
  const layout = carouselLayout(posts.length, 4);

  return (
    <div className={`relative ${layout.frame}`}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-6">
          {posts.map((post) => (
            <div
              key={post.slug}
              className={`flex-[0_0_auto] pl-6 ${layout.slide}`}
            >
              <Link
                href={`/blog/${post.slug}`}
                className="block p-6 bg-white dark:bg-[#252526] rounded-lg border border-gray-200 dark:border-[#303031] transition-colors hover:border-gray-400 dark:hover:border-[#5a5a5a] sm:h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  <time dateTime={post.date} className="text-sm text-gray-500 dark:text-[#a6a6a6]">
                    {formatDate(post.date, 'short')}
                  </time>
                  {post.readingTime && (
                    <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
                      · {post.readingTime} min read
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-[#d4d4d4]">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="font-serif text-gray-600 dark:text-[#cccccc] mb-3 line-clamp-4">
                    {post.description}
                  </p>
                )}
                {post.categories && post.categories.length > 0 && (
                  <div className="flex max-h-6 flex-wrap gap-2 overflow-hidden">
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

      <CarouselArrows onPrev={scrollPrev} onNext={scrollNext} className={layout.arrows} />
    </div>
  );
}
