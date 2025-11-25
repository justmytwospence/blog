/**
 * Code Cell Renderer
 * 
 * Renders code cells with support for:
 * - Solarized syntax highlighting (light and dark themes)
 * - Execution count display in "In [n]:" format
 * - Code visibility controls based on cell options (echo, code-fold)
 * - Toggle buttons for collapsible code
 * - Line numbers (code-line-numbers)
 * - Integration with OutputRenderer for outputs
 */

'use client';

import React, { useState } from 'react';
import type { NotebookCell, QuartoCellOptions } from '@/lib/notebook/types';
import { getCellSource, getCellOptions } from '@/lib/notebook/utils';
import { OutputRenderer } from '../outputs/OutputRenderer';
import { CodeBlock } from '@/components/CodeBlock';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CodeCellProps {
  cell: NotebookCell;
  cellIndex: number;
  language?: string;
  globalOptions?: {
    echo?: boolean;
    output?: boolean;
    include?: boolean;
    warning?: boolean;
    error?: boolean;
    'code-line-numbers'?: boolean;
  };
  codeVisible?: boolean;
  outputVisible?: boolean;
  onCodeVisibilityChange?: (visible: boolean) => void;
  onOutputVisibilityChange?: (visible: boolean) => void;
}

/**
 * CodeCell component
 * 
 * Renders code cells with syntax highlighting, execution counts,
 * visibility controls, and outputs.
 */
export function CodeCell({
  cell,
  cellIndex,
  language = 'python',
  globalOptions = {},
  codeVisible: externalCodeVisible,
  outputVisible: externalOutputVisible,
  onCodeVisibilityChange,
  onOutputVisibilityChange,
}: CodeCellProps) {
  const source = getCellSource(cell);
  const cellOptions = getCellOptions(cell);
  const executionCount = cell.execution_count;
  
  // Determine initial visibility based on cell options and global options
  const initialCodeVisible = determineInitialCodeVisibility(cellOptions, globalOptions);
  const initialOutputVisible = determineInitialOutputVisibility(cellOptions, globalOptions);
  
  // Use external state if provided, otherwise use internal state
  const [internalCodeVisible, setInternalCodeVisible] = useState(initialCodeVisible);
  const [internalOutputVisible, setInternalOutputVisible] = useState(initialOutputVisible);
  
  const codeVisible = externalCodeVisible !== undefined ? externalCodeVisible : internalCodeVisible;
  const outputVisible = externalOutputVisible !== undefined ? externalOutputVisible : internalOutputVisible;
  
  // Determine if code should be collapsible
  const codeFold = cellOptions['code-fold'];
  const isCollapsible = codeFold === true || codeFold === 'show' || codeFold === 'hide';
  
  // Determine if line numbers should be shown
  const showLineNumbers = determineShowLineNumbers(cellOptions, globalOptions);
  
  // Handle code visibility toggle
  const handleCodeToggle = () => {
    const newVisible = !codeVisible;
    if (onCodeVisibilityChange) {
      onCodeVisibilityChange(newVisible);
    } else {
      setInternalCodeVisible(newVisible);
    }
  };
  
  // Handle output visibility toggle
  const handleOutputToggle = () => {
    const newVisible = !outputVisible;
    if (onOutputVisibilityChange) {
      onOutputVisibilityChange(newVisible);
    } else {
      setInternalOutputVisible(newVisible);
    }
  };
  
  // Debug logging for first cell with outputs
  if (typeof window !== 'undefined' && cellIndex === 3) {
    console.log('[CodeCell] Cell 3 options:', {
      cellOptions,
      globalOptions
    });
  }
  
  // Check include option - if false, don't render anything
  const include = cellOptions.include !== undefined ? cellOptions.include : globalOptions.include !== undefined ? globalOptions.include : true;
  if (!include) {
    return null;
  }
  
  // Determine if we should render code section (echo option)
  const echo = cellOptions.echo !== undefined ? cellOptions.echo : globalOptions.echo !== undefined ? globalOptions.echo : true;
  const shouldRenderCode = echo !== false;
  
  // Determine if we should render output section
  const shouldRenderOutput = cellOptions.output !== false && cell.outputs && cell.outputs.length > 0;
  
  return (
    <div className="notebook-code-cell">
      {/* Code section */}
      {shouldRenderCode && (
        <div className="code-section">
          {/* Execution count and toggle button */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Toggle button for collapsible code */}
              {isCollapsible && (
                <button
                  onClick={handleCodeToggle}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  aria-label={codeVisible ? 'Hide code' : 'Show code'}
                >
                  {codeVisible ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>Hide code</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span>Show code</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Code block */}
          {codeVisible && (
            <CodeBlock 
              code={source} 
              language={language} 
              showLineNumbers={showLineNumbers} 
            />
          )}
        </div>
      )}
      
      {/* Output section */}
      {shouldRenderOutput && (
        <div className="output-section mt-4">
          {/* Output toggle button (if code is collapsible, outputs can be too) */}
          {isCollapsible && (
            <div className="mb-2">
              <button
                onClick={handleOutputToggle}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                aria-label={outputVisible ? 'Hide output' : 'Show output'}
              >
                {outputVisible ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Hide output</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    <span>Show output</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Render outputs */}
          <OutputRenderer
            outputs={cell.outputs || []}
            cellOptions={cellOptions}
            globalOptions={globalOptions}
            executionCount={executionCount}
            visible={outputVisible}
            cellIndex={cellIndex}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Determine initial code visibility based on cell and global options
 */
function determineInitialCodeVisibility(
  cellOptions: QuartoCellOptions,
  globalOptions: { echo?: boolean }
): boolean {
  // Cell-level echo option takes precedence
  if (cellOptions.echo === false) {
    return false;
  }
  
  // Check code-fold option
  const codeFold = cellOptions['code-fold'];
  if (codeFold === 'hide') {
    return false;
  }
  if (codeFold === 'show' || codeFold === true) {
    return true;
  }
  
  // Fall back to global echo option
  if (globalOptions.echo === false) {
    return false;
  }
  
  // Default to visible
  return true;
}

/**
 * Determine initial output visibility based on cell and global options
 */
function determineInitialOutputVisibility(
  cellOptions: QuartoCellOptions,
  globalOptions: { output?: boolean }
): boolean {
  // Cell-level output option takes precedence
  if (cellOptions.output === false) {
    return false;
  }
  
  // Fall back to global output option
  if (globalOptions.output === false) {
    return false;
  }
  
  // Default to visible
  return true;
}

/**
 * Determine if line numbers should be shown
 */
function determineShowLineNumbers(
  cellOptions: QuartoCellOptions,
  globalOptions: { 'code-line-numbers'?: boolean }
): boolean {
  // Cell-level option takes precedence
  if (cellOptions['code-line-numbers'] !== undefined) {
    return cellOptions['code-line-numbers'];
  }
  
  // Fall back to global option
  if (globalOptions['code-line-numbers'] !== undefined) {
    return globalOptions['code-line-numbers'];
  }
  
  // Default to false
  return false;
}
