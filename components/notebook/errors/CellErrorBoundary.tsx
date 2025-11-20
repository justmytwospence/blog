/**
 * CellErrorBoundary
 * 
 * Cell-level error boundary for individual notebook cells.
 * Catches and handles errors that occur during cell rendering,
 * allowing other cells to render successfully even if one fails.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface CellErrorBoundaryProps {
  children: ReactNode;
  cellIndex: number;
  cellType: 'code' | 'markdown' | 'raw';
}

interface CellErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

/**
 * CellErrorBoundary component
 * 
 * Wraps individual notebook cells to catch and handle cell-level errors.
 * Displays a compact error message that doesn't disrupt the flow of the notebook.
 */
export class CellErrorBoundary extends Component<
  CellErrorBoundaryProps,
  CellErrorBoundaryState
> {
  constructor(props: CellErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CellErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error(
      `CellErrorBoundary caught an error in cell ${this.props.cellIndex} (${this.props.cellType}):`,
      error
    );
    console.error('Error info:', errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, { cellIndex: this.props.cellIndex, cellType: this.props.cellType, errorInfo });
  }

  toggleDetails = (): void => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { cellIndex, cellType } = this.props;
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="cell-error-boundary my-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          {/* Error header */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                Cell Rendering Error
              </h3>
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                Failed to render {cellType} cell at position {cellIndex + 1}.
              </p>
              {error && (
                <p className="text-xs text-orange-700 dark:text-orange-300 font-mono break-words">
                  {error.message || error.toString()}
                </p>
              )}
            </div>
          </div>

          {/* Toggle details button */}
          {(error || errorInfo) && (
            <button
              onClick={this.toggleDetails}
              className="mt-3 flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Hide Details</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Show Details</span>
                </>
              )}
            </button>
          )}

          {/* Error details (collapsible) */}
          {showDetails && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-orange-300 dark:border-orange-700">
              {error && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Error:
                  </p>
                  <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                    {error.stack || error.toString()}
                  </pre>
                </div>
              )}
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Component Stack:
                  </p>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Help text */}
          <p className="mt-3 text-xs text-orange-700 dark:text-orange-300">
            This cell could not be rendered, but other cells should display normally.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
