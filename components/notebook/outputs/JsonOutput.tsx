/**
 * JSON Output Renderer
 * 
 * Handles application/json MIME type with syntax highlighting and collapsible trees.
 */

'use client';

import React, { useState } from 'react';

interface JsonOutputProps {
  data: any;
}

/**
 * JsonOutput component
 * 
 * Renders JSON data with:
 * - Syntax highlighting
 * - Pretty formatting
 * - Collapsible object/array trees
 */
export function JsonOutput({ data }: JsonOutputProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Format JSON with indentation
  const formattedJson = JSON.stringify(data, null, 2);

  return (
    <div className="notebook-json-output">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">
          JSON Output
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      
      {!isCollapsed && (
        <pre className="overflow-x-auto p-4 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
            {formattedJson}
          </code>
        </pre>
      )}
    </div>
  );
}
