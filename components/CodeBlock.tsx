'use client';

import React from 'react';
import hljs from 'highlight.js/lib/core';
import { languages } from '@/lib/highlight';

// Register all languages from our shared config
Object.entries(languages).forEach(([name, lang]) => {
  hljs.registerLanguage(name, lang);
});

interface CodeBlockProps {
  /** The source code to render */
  code: string;
  /** The language for syntax highlighting */
  language?: string;
  /** Whether to show line numbers (default: false) */
  showLineNumbers?: boolean;
  /** Additional class name for the wrapper */
  className?: string;
}

/**
 * Shared code block component with syntax highlighting and optional line numbers.
 * Used by both notebook cells and markdown blog posts.
 * 
 * Uses table layout for line numbers (matching notebook CSS in globals.css).
 */
export function CodeBlock({ 
  code, 
  language = 'plaintext', 
  showLineNumbers = false,
  className = '',
}: CodeBlockProps) {
  // Highlight the code
  let highlightedCode: string;
  try {
    highlightedCode = hljs.highlight(code, { language }).value;
  } catch {
    // If highlighting fails, escape and use plain text
    highlightedCode = escapeHtml(code);
  }

  const lines = code.split('\n');
  // Remove trailing empty line if present (common in code blocks)
  const displayLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

  return (
    <div className={`code-block-wrapper not-prose rounded-lg border border-gray-300 dark:border-[#454545] overflow-hidden ${className}`}>
      <pre className="overflow-x-auto m-0 p-0 bg-[#fdf6e3] dark:bg-[#1e1e1e]">
        <code className={`hljs language-${language} block p-4`}>
          {showLineNumbers ? (
            <table className="code-table border-collapse w-full">
              <tbody>
                {displayLines.map((line, index) => (
                  <tr key={index} className="leading-relaxed">
                    <td className="line-number-cell text-right pr-4 pl-2 select-none text-[#93a1a1] dark:text-[#858585] border-r border-[rgba(147,161,161,0.3)] dark:border-[rgba(133,133,133,0.3)] align-top whitespace-nowrap w-[1%] text-sm">{index + 1}</td>
                    <td 
                      className="line-content-cell pl-4 whitespace-pre align-top text-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightLine(line, language) 
                      }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          )}
        </code>
      </pre>
    </div>
  );
}

/**
 * Highlight a single line of code
 */
function highlightLine(line: string, language: string): string {
  if (!line) return ' '; // Preserve empty lines
  try {
    return hljs.highlight(line, { language }).value;
  } catch {
    return escapeHtml(line);
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

