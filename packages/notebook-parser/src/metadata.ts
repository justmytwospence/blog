/**
 * Metadata extraction for Jupyter notebooks with Quarto support
 * 
 * This module extracts metadata from Jupyter notebooks, including Quarto-style
 * frontmatter when present, and provides sensible defaults for notebooks without
 * Quarto metadata.
 */

import matter from 'gray-matter';
import type {
  Notebook,
  NotebookCell,
  ExtractedMetadata,
  QuartoFormatOptions,
  QuartoExecuteOptions,
} from './types';

/**
 * Extract metadata from notebook
 * 
 * Checks the first raw cell for Quarto-style frontmatter and extracts metadata.
 * If no frontmatter is found, returns default values with sensible defaults.
 * 
 * @param notebook - Parsed notebook
 * @param slug - Project slug for defaults
 * @returns Extracted metadata with defaults
 */
export function extractMetadata(notebook: Notebook, slug: string): ExtractedMetadata {
  // Check for Quarto frontmatter in the first raw or markdown cell
  const firstCell = notebook.cells[0];
  let frontmatterData: Partial<ExtractedMetadata> | null = null;
  
  if (firstCell && (firstCell.cell_type === 'raw' || firstCell.cell_type === 'markdown')) {
    frontmatterData = parseQuartoFrontmatter(firstCell);
  }
  
  // Get default metadata
  const defaults = getDefaultMetadata(slug);
  
  // Merge frontmatter data with defaults
  if (frontmatterData) {
    return {
      title: frontmatterData.title || defaults.title,
      author: frontmatterData.author || defaults.author,
      date: frontmatterData.date || defaults.date,
      description: frontmatterData.description || defaults.description,
      categories: frontmatterData.categories || defaults.categories,
      featured: frontmatterData.featured !== undefined ? frontmatterData.featured : defaults.featured,
      format: {
        ...defaults.format,
        ...frontmatterData.format,
      },
      execute: {
        ...defaults.execute,
        ...frontmatterData.execute,
      },
    };
  }
  
  return defaults;
}

/**
 * Parse Quarto frontmatter from raw cell
 * 
 * Looks for YAML frontmatter delimited by triple dashes (---) at the beginning
 * and end of the cell source. Parses the YAML and extracts Quarto metadata fields.
 * 
 * @param cell - Raw cell potentially containing frontmatter
 * @returns Parsed metadata or null if no frontmatter
 */
export function parseQuartoFrontmatter(cell: NotebookCell): Partial<ExtractedMetadata> | null {
  if (cell.cell_type !== 'raw' && cell.cell_type !== 'markdown') {
    return null;
  }
  
  // Get cell source as string
  const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  
  // Check if source starts with --- (YAML frontmatter delimiter)
  if (!source.trim().startsWith('---')) {
    return null;
  }
  
  try {
    // Use gray-matter to parse YAML frontmatter
    const parsed = matter(source);
    const data = parsed.data;
    
    // Extract metadata fields
    const metadata: Partial<ExtractedMetadata> = {};
    
    // Basic metadata
    if (data.title) {
      metadata.title = String(data.title);
    }
    
    if (data.author) {
      // Ensure author is either a string or array of strings
      if (Array.isArray(data.author)) {
        metadata.author = data.author.map(String);
      } else {
        metadata.author = String(data.author);
      }
    }
    
    if (data.date) {
      metadata.date = String(data.date);
    }
    
    if (data.description) {
      metadata.description = String(data.description);
    }
    
    if (data.categories) {
      metadata.categories = Array.isArray(data.categories)
        ? data.categories.map(String)
        : [String(data.categories)];
    }
    
    if (data.featured !== undefined) {
      metadata.featured = Boolean(data.featured);
    }
    
    // Quarto format options
    // Can be under 'format' key OR at root level
    const format: QuartoFormatOptions = {};
    
    const formatSource = data.format || data;
    
    if (formatSource['code-fold'] !== undefined) {
      format['code-fold'] = formatSource['code-fold'];
    }
    
    if (formatSource['code-tools'] !== undefined) {
      format['code-tools'] = Boolean(formatSource['code-tools']);
    }
    
    if (formatSource['code-line-numbers'] !== undefined) {
      format['code-line-numbers'] = Boolean(formatSource['code-line-numbers']);
    }
    
    if (formatSource.toc !== undefined) {
      format.toc = Boolean(formatSource.toc);
    }
    
    if (formatSource['toc-depth'] !== undefined) {
      format['toc-depth'] = Number(formatSource['toc-depth']);
    }
    
    if (formatSource['toc-title'] !== undefined) {
      format['toc-title'] = String(formatSource['toc-title']);
    }
    
    if (Object.keys(format).length > 0) {
      metadata.format = format;
    }
    
    // Quarto execute options
    // Can be under 'execute' key OR at root level  
    const execute: QuartoExecuteOptions = {};
    
    const executeSource = data.execute || data;
    
    if (executeSource.echo !== undefined) {
      execute.echo = Boolean(executeSource.echo);
    }
    
    if (executeSource.warning !== undefined) {
      execute.warning = Boolean(executeSource.warning);
    }
    
    if (executeSource.error !== undefined) {
      execute.error = Boolean(executeSource.error);
    }
    
    if (executeSource.output !== undefined) {
      execute.output = Boolean(executeSource.output);
    }
    
    if (executeSource.include !== undefined) {
      execute.include = Boolean(executeSource.include);
    }
    
    if (Object.keys(execute).length > 0) {
      metadata.execute = execute;
    }
    
    // Debug logging
    if (typeof window !== 'undefined') {
      console.log('[metadata.ts] Parsed frontmatter:', {
        rawData: data,
        executeSource: executeSource,
        parsedExecute: execute,
        fullMetadata: metadata
      });
    }
    
    return metadata;
  } catch (error) {
    // If YAML parsing fails, return null
    return null;
  }
}

/**
 * Get default metadata for notebooks without frontmatter
 * 
 * Provides sensible defaults including the slug as title, current date,
 * and default rendering options that show all code and outputs.
 * 
 * @param slug - Project slug
 * @returns Default metadata
 */
export function getDefaultMetadata(slug: string): ExtractedMetadata {
  // Ensure slug is a string
  const slugStr = String(slug || 'untitled');
  
  // Convert slug to title (e.g., "my-project" -> "My Project")
  const title = slugStr
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Get current date in ISO format
  const date = new Date().toISOString().split('T')[0];
  
  return {
    title,
    author: undefined,
    date,
    description: '',
    categories: [],
    featured: false,
    format: {
      'code-fold': false,
      'code-tools': false,
      'code-line-numbers': false,
      toc: true,
      'toc-depth': 3,
      'toc-title': 'Contents',
    },
    execute: {
      echo: true,
      warning: true,
      error: true,
      output: true,
      include: true,
    },
  };
}
