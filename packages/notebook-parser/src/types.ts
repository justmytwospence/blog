/**
 * Type definitions for Jupyter notebook rendering system
 * 
 * This module provides comprehensive TypeScript types for parsing, validating,
 * and rendering Jupyter notebooks with Quarto-compatible features.
 */

/**
 * Jupyter notebook cell types
 */
export type CellType = 'code' | 'markdown' | 'raw';

/**
 * Cell source can be a string or array of strings
 */
export type CellSource = string | string[];

/**
 * Output MIME types supported by the renderer
 */
export type OutputMimeType =
  | 'text/plain'
  | 'text/html'
  | 'image/png'
  | 'image/jpeg'
  | 'image/svg+xml'
  | 'application/json'
  | 'application/vnd.plotly.v1+json'
  | 'application/vnd.jupyter.widget-view+json';

/**
 * Base output structure
 */
export interface BaseOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
}

/**
 * Stream output (stdout/stderr)
 */
export interface StreamOutput extends BaseOutput {
  output_type: 'stream';
  name: 'stdout' | 'stderr';
  text: string | string[];
}

/**
 * Display data or execute result output
 */
export interface DisplayOutput extends BaseOutput {
  output_type: 'display_data' | 'execute_result';
  data: Record<string, any>;
  metadata?: Record<string, any>;
  execution_count?: number | null;
}

/**
 * Error output
 */
export interface ErrorOutput extends BaseOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

/**
 * Union type for all output types
 */
export type CellOutput = StreamOutput | DisplayOutput | ErrorOutput;

/**
 * Quarto cell options
 */
export interface QuartoCellOptions {
  echo?: boolean | 'fenced';
  output?: boolean | 'asis';
  warning?: boolean;
  error?: boolean;
  include?: boolean;
  'code-fold'?: boolean | 'show' | 'hide';
  'code-summary'?: string;
  'code-line-numbers'?: boolean;
  'fig-cap'?: string;
  'fig-alt'?: string;
  'fig-width'?: number;
  'fig-height'?: number;
  label?: string;
}

/**
 * Notebook cell structure
 */
export interface NotebookCell {
  cell_type: CellType;
  source: CellSource;
  metadata?: {
    tags?: string[];
    [key: string]: any;
  } & Partial<QuartoCellOptions>;
  outputs?: CellOutput[];
  execution_count?: number | null;
  id?: string;
}

/**
 * Quarto format options
 */
export interface QuartoFormatOptions {
  'code-fold'?: boolean | 'show' | 'hide';
  'code-tools'?: boolean;
  'code-line-numbers'?: boolean;
  toc?: boolean;
  'toc-depth'?: number;
  'toc-title'?: string;
}

/**
 * Quarto execute options
 */
export interface QuartoExecuteOptions {
  echo?: boolean;
  warning?: boolean;
  error?: boolean;
  output?: boolean;
  include?: boolean;
}

/**
 * Notebook metadata structure
 */
export interface NotebookMetadata {
  kernelspec?: {
    display_name: string;
    language: string;
    name: string;
  };
  language_info?: {
    name: string;
    version?: string;
    mimetype?: string;
    file_extension?: string;
  };
  // Quarto metadata
  title?: string;
  author?: string | string[];
  date?: string;
  description?: string;
  categories?: string[];
  format?: QuartoFormatOptions;
  execute?: QuartoExecuteOptions;
  [key: string]: any;
}

/**
 * Complete notebook structure
 */
export interface Notebook {
  cells: NotebookCell[];
  metadata: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
}

/**
 * Extracted metadata for portfolio integration
 */
export interface ExtractedMetadata {
  title: string;
  author?: string | string[];
  date: string;
  description: string;
  categories: string[];
  featured: boolean;
  format: QuartoFormatOptions;
  execute: QuartoExecuteOptions;
}

/**
 * Table of contents entry
 */
export interface TocEntry {
  id: string;
  level: number;
  text: string;
  children: TocEntry[];
}

/**
 * Figure reference for cross-referencing
 */
export interface FigureReference {
  label: string;
  number: number;
  caption?: string;
  cellIndex: number;
  outputIndex: number;
}
