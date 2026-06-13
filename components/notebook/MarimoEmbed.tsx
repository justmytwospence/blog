'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface MarimoEmbedProps {
  /** Path to the self-hosted WASM export, e.g. `/marimo/<slug>/index.html`. */
  src: string;
  title: string;
  /** Optional fixed height in px. Omit to fill the viewport (recommended). */
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
 * `fallback` and swap in the iframe on mount.
 *
 * The exported marimo app is a viewport-filling SPA with its own chrome, scrolling, and
 * loading screen, so we render it chromeless and full-bleed — no card/border/badge — and
 * let it fill the screen below the nav so it reads as the page itself rather than a boxed
 * widget. (Auto-sizing the iframe to content isn't possible: the app is sized to 100dvh.)
 */
export function MarimoEmbed({ src, title, height, fallback }: MarimoEmbedProps) {
  const [interactive, setInteractive] = useState(false);

  // Initial client render must match SSR (fallback), then upgrade to the iframe.
  useEffect(() => {
    setInteractive(true);
  }, []);

  if (!interactive) {
    return <>{fallback}</>;
  }

  return (
    <iframe
      src={src}
      title={title}
      // Fill the viewport below the sticky nav (h-16) and page padding so the notebook
      // feels like the page, not an embedded box. dvh handles mobile browser chrome.
      style={height ? { height: `${height}px` } : { height: 'calc(100dvh - 8rem)', minHeight: 560 }}
      className="block w-full border-0 bg-transparent"
      sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals"
      allow="microphone; clipboard-write"
      loading="lazy"
    />
  );
}
