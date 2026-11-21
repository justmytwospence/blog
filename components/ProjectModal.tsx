'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/** A dialog over /projects for an intercepted project route; closing goes back in history. */
export function ProjectModal({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture phase and stopped here, so the explorer underneath keeps its pinned day.
      event.stopPropagation();
      router.back();
    };
    window.addEventListener('keydown', onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={() => router.back()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl dark:bg-[#1e1e1e] ${wide ? 'sm:max-w-6xl' : 'sm:max-w-3xl'}`}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 cursor-pointer rounded-full bg-white/90 p-2 text-gray-700 shadow transition-colors hover:bg-gray-100 dark:bg-[#252526]/90 dark:text-[#d4d4d4] dark:hover:bg-[#3a3d41]"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-6 sm:px-8 sm:pt-8">{children}</div>
      </div>
    </div>
  );
}
