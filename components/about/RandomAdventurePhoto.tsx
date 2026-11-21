'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import type { BannerPhoto } from '@/lib/adventures';

const subscribe = () => () => {};

/**
 * A wide photo band showing one of `photos`, chosen afresh on every visit. The page is statically
 * rendered, so the choice has to happen in the browser: the server sends an empty frame of the
 * right shape and the photo fades in once picked, which keeps hydration matching and the layout
 * still. Plain <img>, like the adventure cards: the pool turns over, and running every photo
 * through the image optimizer would spend the quota on pictures shown a handful of times.
 */
export function RandomAdventurePhoto({ photos }: { photos: BannerPhoto[] }) {
  const [roll] = useState(() => Math.random());
  const [loaded, setLoaded] = useState(false);
  // False while server-rendering and hydrating, true from the first client render after.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const photo = mounted && photos.length > 0 ? photos[Math.floor(roll * photos.length)] : null;

  return (
    <figure>
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-gray-100 sm:aspect-[21/9] dark:bg-[#252526]">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={`A photo from ${photo.title}`}
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover object-[50%_45%] transition-opacity duration-700 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
      <figcaption
        className={`mt-3 min-h-5 font-serif text-sm text-gray-500 transition-opacity duration-700 dark:text-[#8f8f8f] ${
          photo && loaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {photo && (
          <>
            Where I&rsquo;d rather be.{' '}
            <Link
              href={`/adventures/${photo.slug}`}
              className="underline decoration-gray-300 underline-offset-4 transition-colors hover:text-blue-600 hover:decoration-blue-500 dark:decoration-[#555] dark:hover:text-blue-400"
            >
              {photo.title}
            </Link>
            ,{' '}
            {new Date(photo.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.
          </>
        )}
      </figcaption>
    </figure>
  );
}
