/**
 * Plotly Output Renderer
 * 
 * Handles application/vnd.plotly.v1+json MIME type.
 * Dynamically loads Plotly.js and renders interactive charts with full interactivity.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PlotlyOutputProps {
  data: any;
}

// Type for Plotly library (loaded dynamically)
type PlotlyType = {
  newPlot: (
    root: HTMLElement,
    data: any,
    layout?: any,
    config?: any
  ) => Promise<void>;
  purge: (root: HTMLElement) => void;
};

/**
 * PlotlyOutput component
 * 
 * Renders Plotly visualizations with:
 * - Dynamic loading of Plotly.js library
 * - Full interactivity (zoom, pan, hover, legend toggling)
 * - Error handling with fallback messages
 * - Independent state for multiple charts
 */
export function PlotlyOutput({ data }: PlotlyOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const plotlyRef = useRef<PlotlyType | null>(null);

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const loadAndRenderPlotly = async () => {
      try {
        // Load Plotly.js dynamically if not already loaded
        if (!plotlyRef.current) {
          // Use dynamic import to load Plotly (named exports)
          const Plotly = await import('plotly.js-dist-min');
          plotlyRef.current = {
            newPlot: Plotly.newPlot,
            purge: Plotly.purge,
          };
        }

        if (!mounted || !containerRef.current) {
          return;
        }

        // Extract data and layout from the Plotly JSON
        const plotlyData = data.data || data;
        const plotlyLayout = data.layout || {};
        
        // Configure Plotly with interactive features enabled
        const config = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: [] as string[],
          // Enable all interactive features
          scrollZoom: true,
        };

        // Let Plotly handle sizing automatically
        const layout = {
          ...plotlyLayout,
          autosize: true,
          // Don't set width - let autosize handle it
          margin: plotlyLayout.margin || { l: 50, r: 50, t: 50, b: 50 },
        };

        // Render the plot
        if (plotlyRef.current && containerRef.current) {
          await plotlyRef.current.newPlot(
            containerRef.current,
            plotlyData,
            layout,
            config
          );
          
          // Set up resize observer to handle container size changes
          if (mounted && containerRef.current) {
            resizeObserver = new ResizeObserver(() => {
              if (mounted && containerRef.current) {
                try {
                  // Check if the div is actually displayed before resizing
                  const rect = containerRef.current.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    // Use Plotly.Plots.resize if available
                    const Plotly = (window as any).Plotly;
                    if (Plotly?.Plots?.resize) {
                      Plotly.Plots.resize(containerRef.current);
                    }
                  }
                } catch (e) {
                  // Silently ignore resize errors
                }
              }
            });
            resizeObserver.observe(containerRef.current);
          }
        }

        if (mounted) {
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Error rendering Plotly chart:', err);
        if (mounted) {
          setError(
            err instanceof Error 
              ? err.message 
              : 'Failed to render Plotly visualization'
          );
          setIsLoading(false);
        }
      }
    };

    loadAndRenderPlotly();

    // Cleanup function
    return () => {
      mounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [data]);

  // Handle errors
  if (error) {
    return (
      <div className="notebook-plotly-output p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
        <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
          Plotly Rendering Error
        </p>
        <p className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="notebook-plotly-output my-4">
      {isLoading && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Loading Plotly visualization...
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        className="plotly-container w-full min-h-[400px]"
        style={{ 
          display: isLoading ? 'none' : 'block',
          width: '100%'
        }}
      />
    </div>
  );
}
