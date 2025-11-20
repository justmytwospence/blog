/**
 * Utility functions for working with Jupyter notebook data
 * 
 * This module provides helper functions for common operations on notebook
 * data structures, including cell source extraction, metadata parsing,
 * table of contents generation, and HTML sanitization.
 */

import type {
  Notebook,
  NotebookCell,
  QuartoCellOptions,
  TocEntry,
  FigureReference,
  CellOutput,
  DisplayOutput,
} from './types';

/**
 * Extract cell source as a single string
 * 
 * Handles both string and array of strings formats for cell source.
 * 
 * @param cell - Notebook cell
 * @returns Cell source as string
 */
export function getCellSource(cell: NotebookCell): string {
  if (!cell || !cell.source) {
    return '';
  }
  if (typeof cell.source === 'string') {
    return cell.source;
  }
  if (Array.isArray(cell.source)) {
    return cell.source.join('');
  }
  // Fallback for unexpected types
  return String(cell.source);
}

/**
 * Check if notebook has any outputs
 * 
 * Scans all code cells to determine if any have outputs.
 * 
 * @param notebook - Notebook to check
 * @returns True if any code cell has outputs
 */
export function hasOutputs(notebook: Notebook): boolean {
  return notebook.cells.some(
    (cell) => cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0
  );
}

/**
 * Get notebook programming language
 * 
 * Extracts language from language_info or kernelspec metadata.
 * 
 * @param notebook - Notebook to check
 * @returns Language name (e.g., 'python', 'r', 'julia')
 */
export function getNotebookLanguage(notebook: Notebook): string {
  // Try language_info first
  if (notebook.metadata.language_info?.name) {
    return notebook.metadata.language_info.name;
  }
  
  // Fall back to kernelspec
  if (notebook.metadata.kernelspec?.language) {
    return notebook.metadata.kernelspec.language;
  }
  
  // Default to python if no language info found
  return 'python';
}

/**
 * Generate table of contents from notebook
 * 
 * Extracts headings from markdown cells and creates a hierarchical structure.
 * 
 * @param notebook - Notebook to process
 * @returns Hierarchical table of contents
 */
export function generateTableOfContents(notebook: Notebook): TocEntry[] {
  const toc: TocEntry[] = [];
  const stack: TocEntry[] = [];
  
  notebook.cells.forEach((cell, cellIndex) => {
    if (cell.cell_type !== 'markdown') {
      return;
    }
    
    const source = getCellSource(cell);
    const lines = source.split('\n');
    
    lines.forEach((line) => {
      // Match markdown headings (# to ######)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) {
        return;
      }
      
      const level = match[1].length;
      const text = String(match[2] || '').trim();
      
      // Generate ID from text (lowercase, replace spaces with hyphens, remove special chars)
      const id = `heading-${cellIndex}-${text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')}`;
      
      const entry: TocEntry = {
        id,
        level,
        text,
        children: [],
      };
      
      // Find the correct parent for this entry
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        // Top-level entry
        toc.push(entry);
      } else {
        // Child entry
        stack[stack.length - 1].children.push(entry);
      }
      
      stack.push(entry);
    });
  });
  
  return toc;
}

/**
 * Generate stable cell ID
 * 
 * Creates a unique identifier for a cell based on its index and content.
 * The ID is stable across renders if the cell content doesn't change.
 * 
 * @param cell - Notebook cell
 * @param index - Cell index
 * @returns Unique cell identifier
 */
export function generateCellId(cell: NotebookCell, index: number): string {
  // Use existing ID if present
  if (cell.id) {
    return cell.id;
  }
  
  // Generate ID from cell type and index
  // For additional stability, we could hash the source content,
  // but for now, index-based IDs are sufficient
  return `cell-${cell.cell_type}-${index}`;
}

/**
 * Extract Quarto cell options from cell metadata
 * 
 * Reads Quarto-style metadata from cell metadata fields.
 * 
 * @param cell - Notebook cell
 * @returns Cell options or empty object
 */
export function getCellOptions(cell: NotebookCell): QuartoCellOptions {
  if (!cell.metadata) {
    return {};
  }
  
  const options: QuartoCellOptions = {};
  
  // Extract known Quarto options from metadata
  const quartoKeys: (keyof QuartoCellOptions)[] = [
    'echo',
    'output',
    'warning',
    'error',
    'include',
    'code-fold',
    'code-summary',
    'code-line-numbers',
    'fig-cap',
    'fig-alt',
    'fig-width',
    'fig-height',
    'label',
  ];
  
  quartoKeys.forEach((key) => {
    if (key in cell.metadata!) {
      (options as any)[key] = cell.metadata![key];
    }
  });
  
  return options;
}

/**
 * Extract figure references from notebook
 * 
 * Scans cells for labeled figures and assigns sequential numbers.
 * 
 * @param notebook - Notebook to process
 * @returns Array of figure references with labels and numbers
 */
export function extractFigureReferences(notebook: Notebook): FigureReference[] {
  const references: FigureReference[] = [];
  let figureNumber = 1;
  
  notebook.cells.forEach((cell, cellIndex) => {
    if (cell.cell_type !== 'code' || !cell.outputs) {
      return;
    }
    
    const options = getCellOptions(cell);
    
    // Only process cells with labels
    if (!options.label) {
      return;
    }
    
    // Check if cell has image outputs
    cell.outputs.forEach((output, outputIndex) => {
      if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
        const displayOutput = output as DisplayOutput;
        
        // Check for image MIME types
        const hasImage = displayOutput.data && (
          'image/png' in displayOutput.data ||
          'image/jpeg' in displayOutput.data ||
          'image/svg+xml' in displayOutput.data
        );
        
        if (hasImage) {
          references.push({
            label: options.label!,
            number: figureNumber++,
            caption: options['fig-cap'],
            cellIndex,
            outputIndex,
          });
        }
      }
    });
  });
  
  return references;
}

/**
 * Sanitize HTML content to prevent XSS
 * 
 * Uses DOMPurify to remove dangerous elements and attributes from HTML.
 * This is a placeholder implementation that should be replaced with actual
 * DOMPurify integration in the browser environment.
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  // In a real implementation, this would use DOMPurify:
  // import DOMPurify from 'dompurify';
  // return DOMPurify.sanitize(html);
  
  // Ensure html is a string
  if (typeof html !== 'string') {
    return String(html || '');
  }
  
  // For now, provide a basic implementation that removes script tags
  // This is NOT production-ready and should be replaced with DOMPurify
  let sanitized = html;
  
  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  return sanitized;
}
