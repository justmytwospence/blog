/**
 * OutputErrorBoundary
 * 
 * Output-level error boundary for individual cell outputs.
 * Catches and handles errors that occur during output rendering,
 * allowing other outputs in the same cell to render successfully.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface OutputErrorBoundaryProps {
  children: ReactNode;
  outputIndex: number;
  outputType?: string;
}

interface OutputErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * OutputErrorBoundary component
 * 
 * Wraps individual cell outputs to catch and handle output-level errors.
 * Displays a minimal error message that doesn't disrupt other outputs.
 */
export class OutputErrorBoundary extends Component<
  OutputErrorBoundaryProps,
  OutputErrorBoundaryState
> {
  constructor(props: OutputErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<OutputErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error(
      `OutputErrorBoundary caught an error in output ${this.props.outputIndex}${
        this.props.outputType ? ` (${this.props.outputType})` : ''
      }:`,
      error
    );
    console.error('Error info:', errorInfo);

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, { outputIndex: this.props.outputIndex, outputType: this.props.outputType, errorInfo });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { outputIndex, outputType } = this.props;
      const { error } = this.state;

      return (
        <div className="output-error-boundary my-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium mb-1">
                Output Rendering Error
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                Failed to render output {outputIndex + 1}
                {outputType && ` (${outputType})`}.
              </p>
              {error && process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-yellow-700 dark:text-yellow-300 font-mono mt-2 break-words">
                  {error.message || error.toString()}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
