'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from 'next-themes';

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) return;

      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          fontFamily: 'Inter, sans-serif',
        });

        const { svg } = await mermaid.render(`mermaid${uniqueId}`, code);
        containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        // Mermaid adds error elements to the DOM on failure — clean up
        const errorEl = document.getElementById(`d${uniqueId}`);
        errorEl?.remove();
      }
    };

    render();
  }, [code, resolvedTheme, uniqueId]);

  if (error) {
    return (
      <pre className="my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center [&>svg]:max-w-full"
    />
  );
}
