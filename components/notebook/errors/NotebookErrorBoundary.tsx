/**
 * NotebookErrorBoundary
 * 
 * Top-level error boundary for the entire notebook renderer.
 * Catches and handles errors that occur during notebook rendering,
 * displaying user-friendly error messages while logging details for debugging.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface NotebookErrorBoundaryProps {
  children: ReactNode;
  notebookTitle?: string;
}

interface NotebookErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * NotebookErrorBoundary component
 * 
 * Wraps the entire notebook renderer to catch and handle top-level errors.
 * Provides a user-friendly error display with the option to retry rendering.
 */
export class NotebookErrorBoundary extends Component<
  NotebookErrorBoundaryProps,
  NotebookErrorBoundaryState
> {
  constructor(props: NotebookErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<NotebookErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error('NotebookErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { notebookTitle } = this.props;
      const { error, errorInfo } = this.state;

      return (
        <div className="notebook-error-boundary min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 shadow-lg">
            {/* Error icon and title */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                  Failed to Render Notebook
                </h2>
                {notebookTitle && (
                  <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                    Notebook: {notebookTitle}
                  </p>
                )}
                <p className="text-red-800 dark:text-red-200">
                  An error occurred while rendering this notebook. This could be due to
                  malformed notebook data, unsupported features, or a rendering issue.
                </p>
              </div>
            </div>

            {/* Error details */}
            {error && (
              <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded border border-red-300 dark:border-red-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Error Details:
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-mono break-words">
                  {error.toString()}
                </p>
                {process.env.NODE_ENV === 'development' && errorInfo && (
                  <details className="mt-3">
                    <summary className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Help text */}
            <p className="mt-4 text-sm text-red-700 dark:text-red-300">
              If this problem persists, the notebook file may be corrupted or incompatible.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
