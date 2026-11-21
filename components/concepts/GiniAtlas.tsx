'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

// The atlas is a self-contained single-file app built in the `gini` repo and served from
// /public/gini/index.html. It posts its own height so the frame never scrolls internally, and it
// takes the theme by message so switching themes does not reload (and reset) the explorer.
export default function GiniAtlas() {
  const { resolvedTheme } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1300);
  const initialTheme = useRef(resolvedTheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'gini-height' && typeof e.data.height === 'number') setHeight(Math.max(600, e.data.height));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'gini-theme', theme: resolvedTheme === 'dark' ? 'dark' : 'light' }, '*');
  }, [resolvedTheme]);

  return (
    <div className="relative left-1/2 w-[min(1280px,calc(100vw-2rem))] -translate-x-1/2">
      <iframe
        ref={frame}
        title="Lorenz curves of societies from 9200 BCE to today"
        src={`/gini/index.html?embed=1&intro=0&theme=${initialTheme.current}`}
        style={{ width: '100%', height, border: 0, display: 'block' }}
        loading="lazy"
        onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'gini-theme', theme: resolvedTheme === 'dark' ? 'dark' : 'light' }, '*')}
      />
    </div>
  );
}
