/**
 * Type definitions for the portfolio website
 */

import type { Notebook } from '@blog/notebook-parser/types';

/**
 * Base metadata for all content items
 */
export interface ContentMetadata {
  title: string;
  date: string;
  slug: string;
  type: 'markdown' | 'notebook' | 'webapp' | 'link' | 'component';
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
  notebookData: Notebook;
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
 * Interactive concept/explainer content
 */
export interface ConceptContent {
  type: 'component';
  content: string; // Optional markdown prose
  component: string; // Component name for dynamic import
  metadata: ContentMetadata;
}

/**
 * Concept metadata
 */
export interface Concept extends ContentMetadata {
  category: 'concept';
  component: string;
}

/**
 * Union type for all content types
 */
export type Content = MarkdownContent | NotebookContent | WebappContent | LinkContent | ConceptContent;

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

