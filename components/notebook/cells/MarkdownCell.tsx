/**
 * Markdown Cell Renderer
 * 
 * Renders markdown cells with support for:
 * - Standard markdown elements (headings, lists, links, code, blockquotes)
 * - LaTeX math rendering with KaTeX
 * - Quarto callout blocks
 * - GitHub-flavored markdown tables
 * - Consistent styling matching markdown posts
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { languages } from '@/lib/highlight';
import type { NotebookCell } from '@/lib/notebook/types';
import { getCellSource } from '@/lib/notebook/utils';
import { CalloutBlock, type CalloutType } from '../CalloutBlock';
import { InteractiveTable } from '../InteractiveTable';
import 'katex/dist/katex.min.css';

interface MarkdownCellProps {
  cell: NotebookCell;
  cellIndex: number;
}

/**
 * Parse Quarto callout blocks from markdown content
 * 
 * Quarto callout syntax:
 * :::{.callout-note}
 * ## Optional Title
 * Content here
 * :::
 * 
 * Or with collapse:
 * :::{.callout-warning collapse="true"}
 * Content
 * :::
 */
interface ParsedCallout {
  type: CalloutType;
  title?: string;
  content: string;
  collapsible: boolean;
  defaultCollapsed: boolean;
}

interface ParsedTable {
  markdown: string;
}

type ContentSegment = 
  | { type: 'markdown'; content: string }
  | { type: 'callout'; content: ParsedCallout }
  | { type: 'table'; content: ParsedTable };

/**
 * Parse markdown content to extract tables, callouts, and regular markdown
 * 
 * This function processes markdown in order, extracting:
 * 1. GitHub-flavored markdown tables
 * 2. Quarto callout blocks
 * 3. Regular markdown content
 */
function parseMarkdownContent(markdown: string): {
  hasSpecialContent: boolean;
  segments: ContentSegment[];
} {
  const segments: ContentSegment[] = [];
  let hasSpecialContent = false;
  
  // First pass: extract callouts and tables
  // Regex to match Quarto callout blocks
  const calloutRegex = /:::(?:\{\.callout-(note|warning|tip|important)(?:\s+collapse=["']?(true|false)["']?)?\})\s*\n([\s\S]*?):::/g;
  
  // Regex to match GitHub-flavored markdown tables
  // Tables must have at least 2 lines: header and separator
  const tableRegex = /(?:^|\n)(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm;
  
  // Collect all special blocks (callouts and tables) with their positions
  interface SpecialBlock {
    type: 'callout' | 'table';
    start: number;
    end: number;
    content: ParsedCallout | ParsedTable;
  }
  
  const specialBlocks: SpecialBlock[] = [];
  
  // Find all callouts
  let match;
  while ((match = calloutRegex.exec(markdown)) !== null) {
    hasSpecialContent = true;
    const calloutType = match[1] as CalloutType;
    const collapse = match[2] === 'true';
    const calloutContent = match[3].trim();
    
    // Check if content starts with a heading (custom title)
    const titleMatch = calloutContent.match(/^##\s+(.+?)(?:\n|$)/);
    let title: string | undefined;
    let content = calloutContent;
    
    if (titleMatch) {
      title = titleMatch[1];
      content = calloutContent.substring(titleMatch[0].length).trim();
    }
    
    specialBlocks.push({
      type: 'callout',
      start: match.index,
      end: match.index + match[0].length,
      content: {
        type: calloutType,
        title,
        content,
        collapsible: collapse,
        defaultCollapsed: collapse,
      },
    });
  }
  
  // Find all tables
  const tableMatches = markdown.matchAll(tableRegex);
  for (const match of tableMatches) {
    if (match.index !== undefined) {
      hasSpecialContent = true;
      const tableMarkdown = match[0].trim();
      specialBlocks.push({
        type: 'table',
        start: match.index,
        end: match.index + match[0].length,
        content: {
          markdown: tableMarkdown,
        },
      });
    }
  }
  
  // Sort blocks by position
  specialBlocks.sort((a, b) => a.start - b.start);
  
  // Build segments
  let lastIndex = 0;
  for (const block of specialBlocks) {
    // Add markdown content before this block
    if (block.start > lastIndex) {
      const beforeContent = markdown.substring(lastIndex, block.start).trim();
      if (beforeContent) {
        segments.push({ type: 'markdown', content: beforeContent });
      }
    }
    
    // Add the special block
    if (block.type === 'callout') {
      segments.push({ type: 'callout', content: block.content as ParsedCallout });
    } else {
      segments.push({ type: 'table', content: block.content as ParsedTable });
    }
    
    lastIndex = block.end;
  }
  
  // Add remaining markdown content
  if (lastIndex < markdown.length) {
    const remainingContent = markdown.substring(lastIndex).trim();
    if (remainingContent) {
      segments.push({ type: 'markdown', content: remainingContent });
    }
  }
  
  return { hasSpecialContent, segments };
}

/**
 * Generate heading ID from text (matches the TOC generation logic)
 */
function generateHeadingId(cellIndex: number, text: string): string {
  return `heading-${cellIndex}-${text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')}`;
}

/**
 * MarkdownCell component
 * 
 * Renders markdown content with full support for:
 * - Standard markdown syntax
 * - LaTeX math (inline and display)
 * - Quarto callout blocks
 * - Tables (will be enhanced with InteractiveTable in future)
 * - Syntax highlighting for code blocks
 */
export function MarkdownCell({ cell, cellIndex }: MarkdownCellProps) {
  const source = getCellSource(cell);
  
  // Create heading components with IDs
  const headingComponents = {
    h1: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h1 id={id} {...props}>{children}</h1>;
    },
    h2: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h2 id={id} {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h3 id={id} {...props}>{children}</h3>;
    },
    h4: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h4 id={id} {...props}>{children}</h4>;
    },
    h5: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h5 id={id} {...props}>{children}</h5>;
    },
    h6: ({ node, children, ...props }: any) => {
      const text = String(children);
      const id = generateHeadingId(cellIndex, text);
      return <h6 id={id} {...props}>{children}</h6>;
    },
  };
  
  // Parse markdown content for tables, callouts, and regular markdown
  const { hasSpecialContent, segments } = parseMarkdownContent(source);

  // If no special content, render as standard markdown
  if (!hasSpecialContent) {
    return (
      <div className="notebook-markdown-cell prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex, [rehypeHighlight, { languages }]]}
          components={{
            // Custom heading rendering with IDs
            ...headingComponents,
            // Custom image rendering
            img: ({ node, ...props }) => (
              <img
                {...props}
                className="rounded-lg shadow-md max-w-full h-auto"
                loading="lazy"
                alt={props.alt || ''}
              />
            ),
            // Custom link rendering
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target={props.href?.startsWith('http') ? '_blank' : undefined}
                rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              />
            ),
            // Custom code block rendering
            code: ({ node, className, children, ...props }: any) => {
              const inline = !className;
              if (inline) {
                return (
                  <code
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // Tables are handled separately - this shouldn't be reached
            // due to pre-processing, but provide fallback
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table
                  className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-300 dark:border-gray-700"
                  {...props}
                />
              </div>
            ),
            th: ({ node, ...props }) => (
              <th
                className="px-4 py-2 text-left text-sm font-semibold bg-gray-100 dark:bg-gray-800"
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                className="px-4 py-2 text-sm border-t border-gray-200 dark:border-gray-700"
                {...props}
              />
            ),
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with special content (tables, callouts)
  return (
    <div className="notebook-markdown-cell">
      {segments.map((segment, index) => {
        if (segment.type === 'markdown') {
          return (
            <div key={`md-${index}`} className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex, [rehypeHighlight, { languages }]]}
                components={{
                  // Custom heading rendering with IDs
                  ...headingComponents,
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="rounded-lg shadow-md max-w-full h-auto"
                      loading="lazy"
                      alt={props.alt || ''}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      target={props.href?.startsWith('http') ? '_blank' : undefined}
                      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    />
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const inline = !className;
                    if (inline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table
                        className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-300 dark:border-gray-700"
                        {...props}
                      />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th
                      className="px-4 py-2 text-left text-sm font-semibold bg-gray-100 dark:bg-gray-800"
                      {...props}
                    />
                  ),
                  td: ({ node, ...props }) => (
                    <td
                      className="px-4 py-2 text-sm border-t border-gray-200 dark:border-gray-700"
                      {...props}
                    />
                  ),
                }}
              >
                {segment.content as string}
              </ReactMarkdown>
            </div>
          );
        } else if (segment.type === 'table') {
          const table = segment.content as ParsedTable;
          return (
            <InteractiveTable
              key={`table-${index}`}
              markdown={table.markdown}
              tableId={`table-${index}`}
            />
          );
        } else {
          const callout = segment.content as ParsedCallout;
          return (
            <CalloutBlock
              key={`callout-${index}`}
              type={callout.type}
              title={callout.title}
              collapsible={callout.collapsible}
              defaultCollapsed={callout.defaultCollapsed}
            >
              <div className="prose prose-slate dark:prose-invert max-w-none prose-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex, [rehypeHighlight, { languages }]]}
                >
                  {callout.content}
                </ReactMarkdown>
              </div>
            </CalloutBlock>
          );
        }
      })}
    </div>
  );
}
