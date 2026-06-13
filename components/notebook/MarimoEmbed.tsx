'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface MarimoEmbedProps {
  /** Path to the self-hosted WASM export, e.g. `/marimo/<slug>/index.html`. */
  src: string;
  title: string;
  /** Iframe height in pixels (default 800). */
  height?: number;
  /**
   * Static render of the notebook. Shown server-side and to no-JS clients (SEO /
   * progressive enhancement); replaced by the interactive iframe once mounted.
   */
  fallback?: ReactNode;
}

/**
 * Interactive marimo notebook embed.
 *
 * marimo `.py` notebooks store no outputs, so the interactive (WebAssembly / Pyodide)
 * build is the only way to surface marimo's reactive widgets, live charts, and SQL.
 * To keep the page crawlable and usable without JS, we server-render the static
 * `fallback` and swap in the iframe on mount — "interactive by default" for JS users,
 * static prose+code for everyone else. Pyodide cold-loads (~15–30MB) inside the iframe.
 */
export function MarimoEmbed({ src, title, height = 800, fallback }: MarimoEmbedProps) {
  const [interactive, setInteractive] = useState(false);

  // Initial client render must match SSR (fallback), then upgrade to the iframe.
  useEffect(() => {
    setInteractive(true);
  }, []);

  if (!interactive) {
    return <>{fallback}</>;
  }

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-lg p-4 sm:p-6">
      <div className="not-prose mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-medium">
          Interactive
        </span>
        <span className="text-sm text-gray-500 dark:text-[#a6a6a6]">
          marimo notebook · runs in your browser (WebAssembly). First load fetches Python and may take a few seconds.
        </span>
      </div>
      <iframe
        src={src}
        title={title}
        style={{ height: `${height}px` }}
        className="w-full border border-gray-200 dark:border-[#303031] rounded bg-white"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals"
        allow="microphone; clipboard-write"
        loading="lazy"
      />
    </div>
  );
}
