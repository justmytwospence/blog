/**
 * Barrel export for notebook rendering system
 * 
 * This module provides a clean import interface for all notebook-related
 * types, functions, and utilities.
 */

// Export all types
export type {
  CellType,
  CellSource,
  OutputMimeType,
  BaseOutput,
  StreamOutput,
  DisplayOutput,
  ErrorOutput,
  CellOutput,
  QuartoCellOptions,
  NotebookCell,
  QuartoFormatOptions,
  QuartoExecuteOptions,
  NotebookMetadata,
  Notebook,
  ExtractedMetadata,
  TocEntry,
  FigureReference,
} from './types';

// Export parser functions
export { parseNotebook, parseNotebookFromString } from './parser';

// Export validator functions
export { validateNotebook, validateCell, isValidNotebook } from './validator';

// Export metadata extractor functions
export { extractMetadata, parseQuartoFrontmatter, getDefaultMetadata } from './metadata';

// Export utility functions
export {
  getCellSource,
  hasOutputs,
  getNotebookLanguage,
  generateTableOfContents,
  generateCellId,
  getCellOptions,
  extractFigureReferences,
  sanitizeHtml,
} from './utils';
