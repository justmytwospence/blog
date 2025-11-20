/**
 * HTML Output Renderer
 * 
 * Handles text/html MIME type with XSS protection through HTML sanitization.
 * Detects and converts HTML tables to interactive React tables.
 */

'use client';

import React, { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/notebook/utils';
import { InteractiveTable } from '../InteractiveTable';

interface HtmlOutputProps {
  html: string;
}

/**
 * Extract table data from HTML table element using regex (works server-side)
 */
function extractTableFromHtml(html: string): { markdown: string; isTruncated: boolean; indexColumns?: number } | null {
  if (!html.includes('<table')) return null;
  
  try {
    // Extract table content using regex
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return null;
    
    const tableContent = tableMatch[1];
    
    // Extract thead and tbody content
    const theadMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const tbodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    
    if (!theadMatch && !tbodyMatch) return null;
    
    // Detect how many index columns there are by examining the first data row FIRST
    // In multi-index DataFrames, index columns use <th> in tbody, data columns use <td>
    const bodyForIndexDetection = tbodyMatch ? tbodyMatch[1] : tableContent;
    const firstDataRowMatch = bodyForIndexDetection.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    let indexColumnCount = 0;
    
    if (firstDataRowMatch) {
      // Count consecutive <th> elements at the start of the row
      const cellsInRow = firstDataRowMatch[1];
      const thMatches = cellsInRow.match(/^(\s*<th[^>]*>([\s\S]*?)<\/th>\s*)*/i);
      if (thMatches && thMatches[0]) {
        const thElements = thMatches[0].match(/<th[^>]*>/g);
        indexColumnCount = thElements ? thElements.length : 0;
      }
    }
    
    // Extract header row
    const headerContent = theadMatch ? theadMatch[1] : tableContent;
    const headerRowMatch = headerContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (!headerRowMatch) return null;
    
    // Extract header cells
    const headerCells = headerRowMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>|<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!headerCells) return null;
    
    const rawHeaders = headerCells.map(cell => {
      // Extract text content, handling nested tags
      const textMatch = cell.match(/>([\s\S]*?)<\/(?:th|td)>/i);
      if (!textMatch) return '';
      const content = textMatch[1].trim();
      // Remove any nested HTML tags but preserve the text
      return content.replace(/<[^>]*>/g, '').trim();
    });
    
    // Build proper headers - pandas multi-index tables often have blank headers for index columns
    // We need to add index column headers if they're missing
    const headers: string[] = [];
    
    // Add index column headers
    for (let i = 0; i < indexColumnCount; i++) {
      if (i < rawHeaders.length && rawHeaders[i] !== '' && rawHeaders[i] !== '&nbsp;') {
        headers.push(rawHeaders[i]);
      } else {
        headers.push(i === 0 ? 'Index' : `Index_${i}`);
      }
    }
    
    // Add data column headers - skip the index headers we already processed
    for (let i = indexColumnCount; i < rawHeaders.length; i++) {
      headers.push(rawHeaders[i] || `Column_${i}`);
    }
    
    // If we have fewer headers than we need based on the data row structure,
    // it means the header row was missing index column headers
    if (headers.length < rawHeaders.length + indexColumnCount - rawHeaders.length) {
      // Pad with generic names
      while (headers.length < indexColumnCount + (rawHeaders.length - indexColumnCount)) {
        headers.push(`Column_${headers.length}`);
      }
    }
    
    if (headers.length === 0) return null;
    
    // Extract data rows
    const bodyContent = tbodyMatch ? tbodyMatch[1] : tableContent;
    const rowMatches = Array.from(bodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    
    const rows: string[][] = [];
    let skipFirst = !tbodyMatch; // Skip first row if no tbody (it's the header)
    let isTruncated = false;
    let lastIndexValues: string[] = []; // Track last multi-index values for rowspan at each level
    
    for (const rowMatch of rowMatches) {
      if (skipFirst) {
        skipFirst = false;
        continue;
      }
      
      // Match both th and td cells - pandas uses th for index column, td for data
      const cellMatches = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>|<th[^>]*>([\s\S]*?)<\/th>/gi);
      if (cellMatches) {
        const cells = cellMatches.map(cell => {
          // Extract text content, handling nested tags
          const textMatch = cell.match(/>([\s\S]*?)<\/(?:td|th)>/i);
          if (!textMatch) return '';
          const content = textMatch[1].trim();
          // Remove any nested HTML tags but preserve the text
          return content.replace(/<[^>]*>/g, '').trim();
        });
        
        // Check if this row indicates truncation (cells contain "..." or "…")
        const hasTruncationMarker = cells.some(cell => cell === '...' || cell === '…');
        
        if (hasTruncationMarker) {
          isTruncated = true;
        }
        
        // Handle multi-index DataFrames with arbitrary levels of rowspan
        // Pandas multi-index creates rowspan for index columns - empty cells indicate continuation
        const processedCells = [...cells];
        
        // Fill in rowspan gaps for each index level
        for (let i = 0; i < indexColumnCount; i++) {
          if (processedCells[i] === '' || processedCells[i] === '&nbsp;') {
            // This cell has rowspan - use the last value from this index level
            if (i < lastIndexValues.length) {
              processedCells[i] = lastIndexValues[i];
            }
          } else if (processedCells[i] !== '') {
            // New value at this index level - update lastIndexValues
            // Also clear any deeper index levels since they reset when a parent level changes
            lastIndexValues = lastIndexValues.slice(0, i);
            lastIndexValues[i] = processedCells[i];
          }
        }
        
        if (processedCells.length > 0) {
          rows.push(processedCells);
        }
      }
    }
    
    if (rows.length === 0) return null;
    
    // Convert to markdown table format
    const headerLine = '| ' + headers.join(' | ') + ' |';
    const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const dataLines = rows.map(row => {
      // Pad or trim row to match header length
      const paddedRow = [...row];
      while (paddedRow.length < headers.length) paddedRow.push('');
      return '| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |';
    });
    
    const markdown = [headerLine, separatorLine, ...dataLines].join('\n');
    
    return { markdown, isTruncated, indexColumns: indexColumnCount };
  } catch (error) {
    console.error('Error parsing HTML table:', error);
    return null;
  }
}

/**
 * HtmlOutput component
 * 
 * Renders HTML content with:
 * - XSS protection via iframe sandboxing for script-containing content
 * - Interactive tables for HTML table elements
 * - Scoped styling to prevent interference with page layout
 * - Support for rich HTML outputs (tables, formatted text, etc.)
 */
export function HtmlOutput({ html }: HtmlOutputProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  
  // Check if this is a table that should be rendered interactively
  const tableData = useMemo(() => {
    if (html.includes('<table')) {
      return extractTableFromHtml(html);
    }
    return null;
  }, [html]);
  
  // If it's a table, render with InteractiveTable
  if (tableData) {
    return <InteractiveTable markdown={tableData.markdown} disableSorting={tableData.isTruncated} indexColumns={tableData.indexColumns} />;
  }
  
  // Check if HTML contains scripts (e.g., Plotly, interactive visualizations)
  const hasScripts = html.includes('<script');
  
  // Wrap HTML in complete document structure for proper script execution
  const iframeDoc = useMemo(() => {
    if (!hasScripts) return null;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: system-ui, -apple-system, sans-serif;
      background: transparent;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }, [html, hasScripts]);
  
  // If HTML contains scripts, render in sandboxed iframe
  if (hasScripts && iframeDoc) {
    return (
      <div className="notebook-html-output w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden">
        <iframe
          srcDoc={iframeDoc}
          sandbox="allow-scripts"
          className="w-full border-0 block"
          style={{ height: '700px' }}
          title="HTML Output"
        />
      </div>
    );
  }
  
  // Otherwise, sanitize and render as HTML (for simple HTML without scripts)
  const sanitizedHtml = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <div 
      className="notebook-html-output prose dark:prose-invert max-w-none p-4 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
