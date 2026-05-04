/**
 * Utility functions for working with Jupyter notebook data
 * 
 * This module provides helper functions for common operations on notebook
 * data structures, including cell source extraction, metadata parsing,
 * table of contents generation, and HTML sanitization.
 */

import sanitizeHtmlLib from 'sanitize-html';
import type {
  Notebook,
  NotebookCell,
  QuartoCellOptions,
  TocEntry,
  FigureReference,
  CellOutput,
  DisplayOutput,
  CrossRefIndex,
  CrossRefEntry,
  CrossRefKind,
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
  const options: QuartoCellOptions = {};
  
  // First, parse #| comment directives from cell source (Quarto-style)
  if (cell.cell_type === 'code' && cell.source) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
    const lines = source.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^#\|\s*([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        
        // Parse the value - handle booleans and strings
        let parsedValue: any = value;
        if (value.toLowerCase() === 'true') {
          parsedValue = true;
        } else if (value.toLowerCase() === 'false') {
          parsedValue = false;
        } else if (!isNaN(Number(value))) {
          parsedValue = Number(value);
        }
        
        // Map to QuartoCellOptions keys
        (options as any)[key] = parsedValue;
      }
    }
  }
  
  // Then, extract options from metadata (takes precedence over comments)
  if (cell.metadata) {
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
  }
  
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
 * Build a notebook-wide cross-reference index in document order.
 *
 * - `fig-*` from code cells whose `label` starts with `fig-` and that produce an image output
 * - `tbl-*` from code cells whose `label` starts with `tbl-`
 * - `lst-*` from code cells whose `label` starts with `lst-`
 * - `sec-*` from markdown headings of the form `## Title {#sec-id}`
 * - `eq-*` from display math blocks of the form `$$ ... $$ {#eq-id}`
 *
 * Numbers are assigned per-kind in the order entries are encountered.
 */
export function buildCrossReferences(notebook: Notebook): CrossRefIndex {
  const index: CrossRefIndex = new Map();
  const counters: Record<CrossRefKind, number> = { fig: 0, tbl: 0, eq: 0, sec: 0, lst: 0 };

  const add = (id: string, caption?: string) => {
    const dash = id.indexOf('-');
    if (dash <= 0) return;
    const prefix = id.slice(0, dash);
    if (prefix !== 'fig' && prefix !== 'tbl' && prefix !== 'eq' && prefix !== 'sec' && prefix !== 'lst') {
      return;
    }
    if (index.has(id)) return;
    const kind = prefix as CrossRefKind;
    counters[kind] += 1;
    index.set(id, { kind, id, number: counters[kind], caption });
  };

  notebook.cells.forEach((cell) => {
    if (cell.cell_type === 'markdown') {
      const source = getCellSource(cell);

      // Sections: `## Title {#sec-id}`
      const headingRe = /^#{1,6}\s+(.+?)\s+\{#(sec-[\w-]+)\}\s*$/gm;
      let m: RegExpExecArray | null;
      while ((m = headingRe.exec(source)) !== null) {
        add(m[2], m[1].trim());
      }

      // Equations: `$$\n...\n$$ {#eq-id}`
      const eqRe = /\$\$[\s\S]+?\$\$\s*\{#(eq-[\w-]+)\}/g;
      while ((m = eqRe.exec(source)) !== null) {
        add(m[1]);
      }
      return;
    }

    if (cell.cell_type !== 'code') return;
    const opts = getCellOptions(cell);
    const label = opts.label;
    if (!label) return;

    if (label.startsWith('fig-')) {
      const hasImage = (cell.outputs ?? []).some((o) => {
        if (o.output_type !== 'display_data' && o.output_type !== 'execute_result') return false;
        const data = (o as DisplayOutput).data ?? {};
        return 'image/png' in data || 'image/jpeg' in data || 'image/svg+xml' in data;
      });
      if (hasImage) add(label, opts['fig-cap']);
    } else if (label.startsWith('tbl-')) {
      add(label, opts['fig-cap']);
    } else if (label.startsWith('lst-')) {
      add(label);
    }
  });

  return index;
}

/**
 * Sanitize HTML content to prevent XSS.
 *
 * Uses sanitize-html (pure JS, no jsdom) so the same call works under
 * Next.js SSR and in the browser without ESM/CJS interop issues. The
 * allowlist is roomy enough for typical Jupyter HTML output (tables,
 * formatted text, images) while stripping <script>, event handlers,
 * and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return sanitizeHtmlLib(html, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat([
      'img', 'figure', 'figcaption', 'span', 'div', 'pre', 'mark',
      'sub', 'sup', 'details', 'summary', 'colgroup', 'col',
    ]),
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      '*': ['class', 'id', 'style', 'title', 'lang', 'dir'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      th: ['scope', 'colspan', 'rowspan', 'class', 'style'],
      td: ['colspan', 'rowspan', 'class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  });
}
