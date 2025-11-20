/**
 * Text Output Renderer
 * 
 * Handles text/plain MIME type and stream outputs (stdout/stderr).
 */

'use client';

import React from 'react';
import type { StreamOutput } from '@/lib/notebook/types';

interface TextOutputProps {
  output: StreamOutput;
}

/**
 * TextOutput component
 * 
 * Renders plain text and stream outputs with appropriate styling.
 * Distinguishes between stdout and stderr streams.
 */
export function TextOutput({ output }: TextOutputProps) {
  // Extract text content (handle both string and array formats)
  const text = typeof output.text === 'string' 
    ? output.text 
    : output.text.join('');

  // Determine styling based on stream type
  const isStderr = output.name === 'stderr';
  const textColorClass = isStderr 
    ? 'text-red-700 dark:text-red-400' 
    : 'text-gray-900 dark:text-gray-100';

  return (
    <pre className={`notebook-text-output overflow-x-auto p-4 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 ${textColorClass}`}>
      <code className="text-sm font-mono whitespace-pre-wrap break-all">
        {text}
      </code>
    </pre>
  );
}
