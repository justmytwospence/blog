/**
 * Notebook validator module
 * 
 * Provides validation functions for Jupyter notebook structure
 * conforming to nbformat 4+ specification.
 */

import { Notebook, NotebookCell, CellType, CellSource } from './types';

/**
 * Validate notebook structure
 * 
 * Validates that the notebook conforms to nbformat 4+ specification
 * including required fields and proper structure.
 * 
 * @param notebook - Notebook object to validate
 * @throws Error with descriptive message if validation fails
 */
export function validateNotebook(notebook: unknown): asserts notebook is Notebook {
  // Check if notebook is an object
  if (typeof notebook !== 'object' || notebook === null) {
    throw new Error('Notebook must be an object');
  }

  const nb = notebook as Record<string, unknown>;

  // Validate nbformat field
  if (!('nbformat' in nb)) {
    throw new Error('Notebook is missing required field: nbformat');
  }
  if (typeof nb.nbformat !== 'number') {
    throw new Error('Notebook nbformat field must be a number');
  }
  if (nb.nbformat < 4) {
    throw new Error(`Notebook nbformat must be 4 or greater, got ${nb.nbformat}`);
  }

  // Validate cells field
  if (!('cells' in nb)) {
    throw new Error('Notebook is missing required field: cells');
  }
  if (!Array.isArray(nb.cells)) {
    throw new Error('Notebook cells field must be an array');
  }

  // Validate each cell
  (nb.cells as unknown[]).forEach((cell, index) => {
    validateCell(cell, index);
  });

  // Validate metadata field (optional but should be object if present)
  if ('metadata' in nb && nb.metadata !== null && typeof nb.metadata !== 'object') {
    throw new Error('Notebook metadata field must be an object');
  }
}

/**
 * Validate individual cell
 * 
 * Validates that a cell has the required structure including
 * cell_type and source fields.
 * 
 * @param cell - Cell object to validate
 * @param index - Cell index for error messages
 * @throws Error with descriptive message if validation fails
 */
export function validateCell(cell: unknown, index: number): asserts cell is NotebookCell {
  // Check if cell is an object
  if (typeof cell !== 'object' || cell === null) {
    throw new Error(`Cell at index ${index} must be an object`);
  }

  const c = cell as Record<string, unknown>;

  // Validate cell_type field
  if (!('cell_type' in c)) {
    throw new Error(`Cell at index ${index} is missing required field: cell_type`);
  }
  if (typeof c.cell_type !== 'string') {
    throw new Error(`Cell at index ${index} has invalid cell_type: must be a string`);
  }
  
  const validCellTypes: CellType[] = ['code', 'markdown', 'raw'];
  if (!validCellTypes.includes(c.cell_type as CellType)) {
    throw new Error(
      `Cell at index ${index} has invalid cell_type: "${c.cell_type}". ` +
      `Must be one of: ${validCellTypes.join(', ')}`
    );
  }

  // Validate source field
  if (!('source' in c)) {
    throw new Error(`Cell at index ${index} is missing required field: source`);
  }
  
  const isString = typeof c.source === 'string';
  const isStringArray = Array.isArray(c.source) && 
    c.source.every((item: unknown) => typeof item === 'string');
  
  if (!isString && !isStringArray) {
    throw new Error(
      `Cell at index ${index} has invalid source field: ` +
      `must be a string or an array of strings`
    );
  }

  // Validate outputs field for code cells (optional but should be array if present)
  if (c.cell_type === 'code' && 'outputs' in c) {
    if (!Array.isArray(c.outputs)) {
      throw new Error(`Cell at index ${index} has invalid outputs field: must be an array`);
    }
  }

  // Validate execution_count for code cells (optional but should be number or null if present)
  if (c.cell_type === 'code' && 'execution_count' in c) {
    if (c.execution_count !== null && typeof c.execution_count !== 'number') {
      throw new Error(
        `Cell at index ${index} has invalid execution_count: must be a number or null`
      );
    }
  }
}

/**
 * Check if object is a valid notebook (type guard)
 * 
 * Non-throwing version of validateNotebook that returns a boolean.
 * 
 * @param obj - Object to check
 * @returns True if object is a valid notebook
 */
export function isValidNotebook(obj: unknown): obj is Notebook {
  try {
    validateNotebook(obj);
    return true;
  } catch {
    return false;
  }
}
