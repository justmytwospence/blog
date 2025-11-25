/**
 * Main Notebook Renderer Component
 * 
 * Orchestrates the rendering of complete Jupyter notebooks with support for:
 * - Global visibility controls (Show/Hide All Code/Output)
 * - Per-cell visibility state management
 * - Quarto metadata and cell options
 * - Responsive layout
 * - Empty notebook handling
 * - Server-side rendering compatibility
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Notebook, ExtractedMetadata } from '@/lib/notebook/types';
import { generateCellId, getNotebookLanguage, generateTableOfContents } from '@/lib/notebook/utils';
import { CodeCell } from './cells/CodeCell';
import { MarkdownCell } from './cells/MarkdownCell';
import { CellErrorBoundary } from './errors/CellErrorBoundary';
import { TableOfContents } from './TableOfContents';
import { TocDrawer } from './TocDrawer';
import { Eye, EyeOff, FileText, Hash } from 'lucide-react';

interface NotebookRendererProps {
  notebook: Notebook;
  metadata: ExtractedMetadata;
}

/**
 * NotebookRenderer component
 * 
 * Main component for rendering Jupyter notebooks with full support for
 * Quarto features, visibility controls, and responsive layout.
 */
export function NotebookRenderer({ notebook, metadata }: NotebookRendererProps) {
  const language = getNotebookLanguage(notebook);
  
  // Initialize cell visibility based on Quarto metadata and cell options
  // Use useMemo to compute initial state synchronously to avoid hydration mismatch
  const initialVisibility = useMemo(() => {
    const codeVisMap = new Map<string, boolean>();
    const outputVisMap = new Map<string, boolean>();
    
    notebook.cells.forEach((cell, index) => {
      const cellId = generateCellId(cell, index);
      
      if (cell.cell_type === 'code') {
        // Determine initial code visibility
        const cellOptions = cell.metadata || {};
        
        // Check cell-level echo option
        if (cellOptions.echo === false) {
          codeVisMap.set(cellId, false);
        } else if (cellOptions['code-fold'] === 'hide') {
          codeVisMap.set(cellId, false);
        } else if (cellOptions['code-fold'] === 'show' || cellOptions['code-fold'] === true) {
          codeVisMap.set(cellId, true);
        } else if (metadata.execute?.echo === false) {
          // Fall back to global execute option
          codeVisMap.set(cellId, false);
        } else {
          codeVisMap.set(cellId, true);
        }
        
        // Determine initial output visibility
        if (cellOptions.output === false) {
          outputVisMap.set(cellId, false);
        } else if (metadata.execute?.output === false) {
          outputVisMap.set(cellId, false);
        } else {
          outputVisMap.set(cellId, true);
        }
      }
    });
    
    return { codeVisMap, outputVisMap };
  }, [notebook, metadata]);
  
  // Per-cell visibility state (Map of cell ID to visibility)
  const [cellCodeVisibility, setCellCodeVisibility] = useState<Map<string, boolean>>(initialVisibility.codeVisMap);
  const [cellOutputVisibility, setCellOutputVisibility] = useState<Map<string, boolean>>(initialVisibility.outputVisMap);
  
  // Line numbers toggle state
  const [showLineNumbers, setShowLineNumbers] = useState(metadata.format?.['code-line-numbers'] ?? false);
  
  // Check if all code is currently visible
  const allCodeVisible = useMemo(() => {
    const codeCells = notebook.cells.filter(cell => cell.cell_type === 'code');
    if (codeCells.length === 0) return true;
    
    return codeCells.every((cell, index) => {
      const cellId = generateCellId(cell, index);
      return cellCodeVisibility.get(cellId) ?? true;
    });
  }, [notebook.cells, cellCodeVisibility]);
  
  // Check if all output is currently visible
  const allOutputVisible = useMemo(() => {
    const codeCells = notebook.cells.filter(cell => cell.cell_type === 'code');
    if (codeCells.length === 0) return true;
    
    return codeCells.every((cell, index) => {
      const cellId = generateCellId(cell, index);
      return cellOutputVisibility.get(cellId) ?? true;
    });
  }, [notebook.cells, cellOutputVisibility]);
  
  // Toggle all code visibility
  const handleToggleAllCode = () => {
    const newVisibility = !allCodeVisible;
    const newMap = new Map(cellCodeVisibility);
    notebook.cells.forEach((cell, index) => {
      if (cell.cell_type === 'code') {
        const cellId = generateCellId(cell, index);
        newMap.set(cellId, newVisibility);
      }
    });
    setCellCodeVisibility(newMap);
  };
  
  // Toggle all output visibility
  const handleToggleAllOutput = () => {
    const newVisibility = !allOutputVisible;
    const newMap = new Map(cellOutputVisibility);
    notebook.cells.forEach((cell, index) => {
      if (cell.cell_type === 'code') {
        const cellId = generateCellId(cell, index);
        newMap.set(cellId, newVisibility);
      }
    });
    setCellOutputVisibility(newMap);
  };
  
  // Handle individual cell code visibility change
  const handleCellCodeVisibilityChange = (cellId: string, visible: boolean) => {
    const newMap = new Map(cellCodeVisibility);
    newMap.set(cellId, visible);
    setCellCodeVisibility(newMap);
  };
  
  // Handle individual cell output visibility change
  const handleCellOutputVisibilityChange = (cellId: string, visible: boolean) => {
    const newMap = new Map(cellOutputVisibility);
    newMap.set(cellId, visible);
    setCellOutputVisibility(newMap);
  };
  
  // Handle empty notebooks
  if (!notebook.cells || notebook.cells.length === 0) {
    return (
      <div className="notebook-renderer">
        <div className="empty-notebook p-8 text-center bg-gray-50 dark:bg-stone-900 rounded-lg border border-gray-200 dark:border-stone-700">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-stone-400">
            This notebook is empty.
          </p>
        </div>
      </div>
    );
  }
  
  // Global options from metadata
  const globalOptions = {
    echo: metadata.execute?.echo,
    output: metadata.execute?.output,
    include: metadata.execute?.include,
    warning: metadata.execute?.warning,
    error: metadata.execute?.error,
    'code-line-numbers': showLineNumbers,
  };
  
  // Debug logging
  useEffect(() => {
    console.log('[NotebookRenderer] Global options:', {
      metadata,
      globalOptions
    });
  }, [metadata, globalOptions]);
  
  // Generate table of contents
  const tocEntries = generateTableOfContents(notebook);
  
  // Controls component (shared between layouts)
  const ControlsPanel = ({ className = '' }: { className?: string }) => (
    <div className={`p-4 bg-white dark:bg-stone-900 rounded-lg border border-gray-200 dark:border-stone-700 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-stone-100">
        Controls
      </h3>
      <div className="space-y-2 md-toc:space-y-0 md-toc:flex md-toc:gap-2 code-80:space-y-2 code-80:flex-col">
        {/* Toggle Code Visibility */}
        <button
          onClick={handleToggleAllCode}
          className={`w-full md-toc:w-auto flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
            allCodeVisible
              ? 'bg-blue-50 dark:bg-amber-900/20 text-blue-700 dark:text-amber-400 hover:bg-blue-100 dark:hover:bg-amber-900/30'
              : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700'
          }`}
          aria-label={allCodeVisible ? 'Hide all code' : 'Show all code'}
        >
          {allCodeVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>{allCodeVisible ? 'Hide' : 'Show'} Code</span>
        </button>
        
        {/* Toggle Output Visibility */}
        <button
          onClick={handleToggleAllOutput}
          className={`w-full md-toc:w-auto flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
            allOutputVisible
              ? 'bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 hover:bg-green-100 dark:hover:bg-emerald-900/30'
              : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700'
          }`}
          aria-label={allOutputVisible ? 'Hide all output' : 'Show all output'}
        >
          {allOutputVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>{allOutputVisible ? 'Hide' : 'Show'} Output</span>
        </button>
        
        {/* Toggle Line Numbers */}
        <button
          onClick={() => setShowLineNumbers(!showLineNumbers)}
          className={`w-full md-toc:w-auto flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
            showLineNumbers
              ? 'bg-purple-50 dark:bg-violet-900/20 text-purple-700 dark:text-violet-400 hover:bg-purple-100 dark:hover:bg-violet-900/30'
              : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700'
          }`}
          aria-label={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
        >
          <Hash className="w-4 h-4" />
          <span>{showLineNumbers ? 'Hide' : 'Show'} Line #</span>
        </button>
      </div>
    </div>
  );
  
  return (
    <>
      {/* Mobile: Bottom drawer for TOC and Controls (below md-toc breakpoint) */}
      <div className="md-toc:hidden">
        <TocDrawer 
          entries={tocEntries}
          allCodeVisible={allCodeVisible}
          allOutputVisible={allOutputVisible}
          showLineNumbers={showLineNumbers}
          onToggleAllCode={handleToggleAllCode}
          onToggleAllOutput={handleToggleAllOutput}
          onToggleLineNumbers={() => setShowLineNumbers(!showLineNumbers)}
        />
      </div>
      
      {/* Medium screens: TOC above notebook (md-toc to code-80) */}
      <div className="hidden md-toc:block mb-6 space-y-4" style={{ '--hide-above': 'calc(80ch + 312px)' } as React.CSSProperties} data-toc-header>
        <ControlsPanel />
        {tocEntries.length > 0 && (
          <TableOfContents 
            entries={tocEntries} 
            variant="header"
            className="overflow-hidden"
          />
        )}
      </div>
      
      <div className="code-80:grid code-80:grid-cols-[1fr_280px] code-80:gap-8 code-80:relative">
        {/* Main content area */}
        <div className="notebook-renderer min-w-0">
          {/* Render cells */}
          <div className="notebook-cells space-y-6 *:first:mt-0! *:first:*:mt-0! *:first:*:pt-4">
        {notebook.cells.map((cell, index) => {
          const cellId = generateCellId(cell, index);
          
          // Skip raw cells (they are not displayed)
          if (cell.cell_type === 'raw') {
            return null;
          }
          
          // Render markdown cells
          if (cell.cell_type === 'markdown') {
            return (
              <CellErrorBoundary key={cellId} cellIndex={index} cellType="markdown">
                <div id={cellId}>
                  <MarkdownCell cell={cell} cellIndex={index} />
                </div>
              </CellErrorBoundary>
            );
          }
          
          // Render code cells
          if (cell.cell_type === 'code') {
            const codeVisible = cellCodeVisibility.get(cellId) ?? true;
            const outputVisible = cellOutputVisibility.get(cellId) ?? true;
            
            return (
              <CellErrorBoundary key={cellId} cellIndex={index} cellType="code">
                <div id={cellId}>
                  <CodeCell
                    cell={cell}
                    cellIndex={index}
                    language={language}
                    globalOptions={globalOptions}
                    codeVisible={codeVisible}
                    outputVisible={outputVisible}
                    onCodeVisibilityChange={(visible) =>
                      handleCellCodeVisibilityChange(cellId, visible)
                    }
                    onOutputVisibilityChange={(visible) =>
                      handleCellOutputVisibilityChange(cellId, visible)
                    }
                  />
                </div>
              </CellErrorBoundary>
            );
          }
          
          return null;
        })}
          </div>
        </div>
        
        {/* Sidebar with controls and table of contents - Large screens only */}
        <aside className="hidden code-80:block">
          <div className="fixed top-[97px] w-[280px] space-y-4 flex flex-col max-h-[calc(100vh-6.0625rem)]">
            {/* Controls - Sticky at top */}
            <ControlsPanel className="shrink-0" />
            
            {/* Table of Contents - Scrollable */}
            {tocEntries.length > 0 && (
              <TableOfContents entries={tocEntries} className="overflow-hidden max-h-[calc(100vh-20rem)]" />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
