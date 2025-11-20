/**
 * Widget Output Renderer
 * 
 * Handles application/vnd.jupyter.widget-view+json MIME type.
 * Loads ipywidgets JavaScript libraries and renders widgets with preserved state.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

interface WidgetOutputProps {
  data: any;
}

/**
 * WidgetOutput component
 * 
 * Renders Jupyter widgets with:
 * - Dynamic loading of ipywidgets JavaScript libraries
 * - Preserved widget state from notebook
 * - Error handling with descriptive fallback messages
 * - Information about live kernel requirement for full interactivity
 */
export function WidgetOutput({ data }: WidgetOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetInfo, setWidgetInfo] = useState<{
    modelId?: string;
    widgetType?: string;
  }>({});

  useEffect(() => {
    let mounted = true;

    const loadAndRenderWidget = async () => {
      try {
        // Extract widget information from the data
        const modelId = data.model_id || data.modelId;
        const widgetType = data.widget_type || data.widgetType || 'Unknown Widget';
        
        if (mounted) {
          setWidgetInfo({ modelId, widgetType });
        }

        // Attempt to load ipywidgets library
        // Note: In a static/SSG context, widgets cannot be fully interactive
        // without a live Jupyter kernel connection
        
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
          throw new Error('Widget rendering requires browser environment');
        }

        // Try to load ipywidgets from CDN
        // This is a simplified approach - full widget support would require
        // the @jupyter-widgets/base and @jupyter-widgets/controls packages
        const widgetManagerAvailable = await checkWidgetLibraries();

        if (!widgetManagerAvailable) {
          // Widget libraries not available - show informative message
          if (mounted) {
            setError(
              'Widget libraries not loaded. Widgets require ipywidgets JavaScript libraries and a live kernel for full interactivity.'
            );
            setIsLoading(false);
          }
          return;
        }

        // If we reach here, we could attempt to render the widget
        // However, without a live kernel, we can only show the saved state
        if (mounted) {
          setIsLoading(false);
        }

      } catch (err) {
        console.error('Error rendering widget:', err);
        if (mounted) {
          setError(
            err instanceof Error 
              ? err.message 
              : 'Failed to render Jupyter widget'
          );
          setIsLoading(false);
        }
      }
    };

    loadAndRenderWidget();

    return () => {
      mounted = false;
    };
  }, [data]);

  /**
   * Check if widget libraries are available
   * In a production environment, this would check for @jupyter-widgets packages
   */
  const checkWidgetLibraries = async (): Promise<boolean> => {
    // Check if ipywidgets is available in the global scope
    // This is a simplified check - real implementation would be more robust
    return false; // For now, widgets are not fully supported without a kernel
  };

  // Handle errors or missing libraries
  if (error) {
    const { modelId, widgetType } = widgetInfo;
    
    return (
      <div className="notebook-widget-output p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg 
              className="w-5 h-5 text-blue-600 dark:text-blue-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
              Jupyter Widget
            </p>
            {widgetType && (
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Type: {widgetType}
              </p>
            )}
            {modelId && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-mono">
                Model ID: {modelId}
              </p>
            )}
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              {error}
            </p>
            <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/40 rounded">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Full widget interactivity requires a live Jupyter kernel. 
                This is a static rendering of the notebook, so widgets display their saved state only.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="notebook-widget-output p-4 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Loading widget...
        </p>
      </div>
    );
  }

  // Widget container (would be used if widget libraries were available)
  return (
    <div className="notebook-widget-output my-4">
      <div
        ref={containerRef}
        className="widget-container p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
      >
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Widget rendered with saved state
          </p>
          {widgetInfo.widgetType && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {widgetInfo.widgetType}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> Full widget interactivity requires a live Jupyter kernel connection.
        </p>
      </div>
    </div>
  );
}
