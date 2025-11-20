/**
 * Error Output Renderer
 * 
 * Handles error output type with formatted error messages and tracebacks.
 */

'use client';

import React from 'react';
import type { ErrorOutput as ErrorOutputType } from '@/lib/notebook/types';

interface ErrorOutputProps {
  output: ErrorOutputType;
}

/**
 * ErrorOutput component
 * 
 * Renders error outputs with:
 * - Error name and value prominently displayed
 * - Formatted traceback with ANSI color code handling
 * - Error-specific styling (red theme)
 */
export function ErrorOutput({ output }: ErrorOutputProps) {
  const { ename, evalue, traceback } = output;

  // Process traceback to remove ANSI color codes for now
  // In a more advanced implementation, we could convert ANSI codes to HTML styling
  const cleanTraceback = traceback.map(line => 
    line.replace(/\x1b\[[0-9;]*m/g, '')
  );

  return (
    <div className="notebook-error-output border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded">
      {/* Error header */}
      <div className="error-header mb-2">
        <span className="font-bold text-red-700 dark:text-red-400">
          {ename}
        </span>
        {evalue && (
          <span className="text-red-600 dark:text-red-300 ml-2">
            : {evalue}
          </span>
        )}
      </div>

      {/* Traceback */}
      {cleanTraceback.length > 0 && (
        <pre className="error-traceback overflow-x-auto text-sm font-mono text-red-800 dark:text-red-200 whitespace-pre-wrap break-all">
          {cleanTraceback.join('\n')}
        </pre>
      )}
    </div>
  );
}
