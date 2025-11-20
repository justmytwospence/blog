/**
 * Notebook parser module
 * 
 * Provides functions for reading and parsing Jupyter notebook files (.ipynb)
 * with comprehensive error handling and validation.
 */

import { readFileSync } from 'fs';
import { Notebook } from './types';
import { validateNotebook } from './validator';

/**
 * Parse a notebook file from the file system
 * 
 * @param filePath - Absolute path to the .ipynb file
 * @returns Parsed and validated notebook
 * @throws Error if file not found or invalid JSON
 * @throws Error if notebook structure is invalid
 */
export function parseNotebook(filePath: string): Notebook {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    return parseNotebookFromString(fileContent);
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a file system error
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(`Notebook file not found: ${filePath}`);
      }
      // Re-throw validation or parsing errors
      throw error;
    }
    throw new Error(`Failed to read notebook file: ${filePath}`);
  }
}

/**
 * Parse notebook from JSON string
 * 
 * @param jsonContent - JSON string content
 * @returns Parsed and validated notebook
 * @throws Error if invalid JSON or invalid notebook structure
 */
export function parseNotebookFromString(jsonContent: string): Notebook {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in notebook: ${error.message}`);
    }
    throw new Error('Failed to parse notebook JSON');
  }
  
  // Validate the parsed notebook structure
  // After validation, TypeScript knows parsed is a Notebook
  validateNotebook(parsed);
  
  // TypeScript now knows parsed is Notebook due to assertion
  return parsed as Notebook;
}
