'use client';

import { useState } from 'react';

interface WebappEmbedProps {
  url: string;
  height?: string;
  title?: string;
}

export default function WebappEmbed({ url, height = '600px', title }: WebappEmbedProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate URL
  const isValidUrl = (urlString: string): boolean => {
    try {
      const parsedUrl = new URL(urlString, window.location.origin);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load the embedded application. Please check the URL and try again.');
  };

  if (!url) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h3 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
          No URL provided
        </h3>
        <p className="text-yellow-600 dark:text-yellow-300">
          Please provide a valid URL for the embedded application.
        </p>
      </div>
    );
  }

  if (!isValidUrl(url)) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
          Invalid URL
        </h3>
        <p className="text-red-600 dark:text-red-300">
          The provided URL is not valid: <code className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded">{url}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="webapp-embed-container">
      {title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
      )}
      
      <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg">
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
            style={{ height }}
          >
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading application...</p>
            </div>
          </div>
        )}
        
        {error ? (
          <div 
            className="flex items-center justify-center bg-red-50 dark:bg-red-900/20"
            style={{ height }}
          >
            <div className="text-center p-6">
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
                Failed to load application
              </h3>
              <p className="text-red-600 dark:text-red-300">{error}</p>
            </div>
          </div>
        ) : (
          <iframe
            src={url}
            title={title || 'Embedded Application'}
            className="w-full"
            style={{ height }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
        )}
      </div>
      
      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Interactive application embedded from: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{url}</code>
        </p>
      </div>
    </div>
  );
}
