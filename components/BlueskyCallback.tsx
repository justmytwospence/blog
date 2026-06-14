'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initBluesky, readCallbackState } from '@/lib/blueskyClient';

/**
 * Lands here after the visitor authorizes on Bluesky. `initBluesky()` completes
 * the PKCE code exchange, stores the session, and returns the `state` we passed
 * at sign-in (the path of the post they were reading) so we can send them back.
 */
export default function BlueskyCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { result } = await initBluesky();
        if (!alive) return;
        const dest = readCallbackState(result) ?? '/';
        router.replace(dest.startsWith('/') ? dest : '/');
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      {failed ? (
        <p className="text-gray-600 dark:text-[#cccccc]">
          Sign-in didn&apos;t complete.{' '}
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Go home
          </button>
        </p>
      ) : (
        <p className="text-gray-600 dark:text-[#cccccc]">Finishing sign-in…</p>
      )}
    </div>
  );
}
