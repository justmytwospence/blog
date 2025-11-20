import matter from 'gray-matter';
import { Frontmatter } from './types';

/**
 * Parse markdown content with frontmatter
 */
export function parseMarkdown(markdownContent: string): {
  frontmatter: Frontmatter;
  content: string;
} {
  const { data, content } = matter(markdownContent);
  
  // Validate required frontmatter fields
  validateFrontmatter(data);
  
  return {
    frontmatter: data as Frontmatter,
    content,
  };
}

/**
 * Validate frontmatter schema
 */
export function validateFrontmatter(data: any): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid frontmatter: must be an object');
  }
  
  // Title is required
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Invalid frontmatter: title is required and must be a string');
  }
  
  // Date is required
  if (!data.date || typeof data.date !== 'string') {
    throw new Error('Invalid frontmatter: date is required and must be a string');
  }
  
  // Validate date format
  const dateObj = new Date(data.date);
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid frontmatter: date must be a valid date string');
  }
  
  // Tags should be an array if present
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    throw new Error('Invalid frontmatter: tags must be an array');
  }
  
  // Description should be a string if present
  if (data.description !== undefined && typeof data.description !== 'string') {
    throw new Error('Invalid frontmatter: description must be a string');
  }
  
  // Featured should be a boolean if present
  if (data.featured !== undefined && typeof data.featured !== 'boolean') {
    throw new Error('Invalid frontmatter: featured must be a boolean');
  }
}

/**
 * Extract excerpt from markdown content
 */
export function extractExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown syntax for a clean excerpt
  const plainText = content
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/`(.+?)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  // Truncate at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Calculate reading time for markdown content
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / wordsPerMinute);
}
