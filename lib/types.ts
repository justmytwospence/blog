/**
 * Type definitions for the portfolio website
 */

/**
 * Static page content (home, about, contact)
 */
export interface PageContent {
  title: string;
  content: string; // Markdown content
}

/**
 * Base metadata for all content items
 */
export interface ContentMetadata {
  title: string;
  date: string;
  slug: string;
  type: 'markdown' | 'notebook' | 'webapp' | 'link';
  categories?: string[];
  description?: string;
  featured?: boolean;
  externalUrl?: string;
}

/**
 * Project content metadata
 */
export interface Project extends ContentMetadata {
  category: 'project';
}

/**
 * Blog post metadata
 */
export interface BlogPost extends ContentMetadata {
  category: 'blog';
  readingTime?: number;
}

/**
 * Markdown content with parsed frontmatter
 */
export interface MarkdownContent {
  type: 'markdown';
  content: string;
  metadata: ContentMetadata;
}

/**
 * Jupyter notebook content
 */
export interface NotebookContent {
  type: 'notebook';
  notebookData: any; // Raw ipynb JSON object
  metadata: ContentMetadata;
}

/**
 * Embedded webapp configuration
 */
export interface WebappContent {
  type: 'webapp';
  url: string;
  height?: string;
  metadata: ContentMetadata;
}

/**
 * External link content
 */
export interface LinkContent {
  type: 'link';
  content?: string;
  metadata: ContentMetadata;
}

/**
 * Union type for all content types
 */
export type Content = MarkdownContent | NotebookContent | WebappContent | LinkContent;

/**
 * Frontmatter structure for markdown files
 */
export interface Frontmatter {
  title: string;
  date: string;
  categories?: string[];
  description?: string;
  featured?: boolean;
  externalUrl?: string;
  [key: string]: any;
}

/**
 * Webapp configuration file structure
 */
export interface WebappConfig {
  title: string;
  date: string;
  categories?: string[];
  description?: string;
  url: string;
  height?: string;
  featured?: boolean;
}
