/**
 * Interactive Table Component
 * 
 * Renders GitHub-flavored markdown tables as interactive React tables with:
 * - Column sorting for all columns
 * - Pagination for tables with more than 10 rows
 * - Horizontal scrolling for wide tables
 * - Consistent styling matching the notebook theme
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
 */

'use client';

import { useState, useMemo } from 'react';

interface TableData {
  headers: string[];
  rows: string[][];
}

interface InteractiveTableProps {
  /** Markdown table string to parse and render */
  markdown: string;
  /** Optional unique identifier for the table */
  tableId?: string;
  /** Disable sorting (e.g., when table data is truncated) */
  disableSorting?: boolean;
  /** Number of leading columns that are index columns (for multi-index DataFrames) */
  indexColumns?: number;
}

/**
 * Parse GitHub-flavored markdown table into structured data
 * 
 * Expected format:
 * | Header 1 | Header 2 |
 * |----------|----------|
 * | Cell 1   | Cell 2   |
 * 
 * @param markdown - Markdown table string
 * @returns Parsed table data with headers and rows
 */
function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown.trim().split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return null;
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0);

  if (headers.length === 0) {
    return null;
  }

  // Skip separator line (line 1)
  // Parse data rows (lines 2+)
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split('|')
      .map(cell => cell.trim())
      .filter((cellValue, index, arr) => {
        // Filter out empty cells at start/end from leading/trailing pipes
        if (index === 0 || index === arr.length - 1) {
          return cellValue.length > 0;
        }
        return true;
      });

    if (cells.length > 0) {
      // Pad or trim to match header count
      while (cells.length < headers.length) {
        cells.push('');
      }
      rows.push(cells.slice(0, headers.length));
    }
  }

  return { headers, rows };
}

type SortDirection = 'asc' | 'desc' | null;

/**
 * InteractiveTable component
 * 
 * Parses and renders markdown tables with interactive features:
 * - Click column headers to sort (unless disabled)
 * - Automatic pagination for tables > 10 rows
 * - Horizontal scrolling for wide tables
 * - Responsive styling
 */
export function InteractiveTable({ markdown, tableId, disableSorting = false, indexColumns = 0 }: InteractiveTableProps) {
  const tableData = useMemo(() => parseMarkdownTable(markdown), [markdown]);
  
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Detect index column groups for visual grouping
  const indexGroups = useMemo(() => {
    if (!tableData || indexColumns === 0) return null;
    
    const groups: number[] = new Array(tableData.rows.length).fill(0);
    let currentGroup = 0;
    
    for (let i = 0; i < tableData.rows.length; i++) {
      if (i === 0) {
        groups[i] = currentGroup;
      } else {
        // Check if any of the index columns changed
        let indexChanged = false;
        for (let col = 0; col < indexColumns; col++) {
          if (tableData.rows[i][col] !== tableData.rows[i - 1][col]) {
            indexChanged = true;
            break;
          }
        }
        
        if (indexChanged) {
          currentGroup++;
        }
        groups[i] = currentGroup;
      }
    }
    
    return groups;
  }, [tableData, indexColumns]);

  const rowsPerPage = 10;

  if (!tableData) {
    // Fallback: render as plain text if parsing fails
    return (
      <div className="my-4 p-4 bg-gray-50 dark:bg-stone-900 rounded border border-gray-300 dark:border-stone-700">
        <pre className="text-sm whitespace-pre-wrap">{markdown}</pre>
      </div>
    );
  }

  const { headers, rows } = tableData;

  // Sort rows if a column is selected
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortDirection === null) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      // Try numeric comparison first
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Fall back to string comparison
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortColumn, sortDirection]);

  // Paginate rows
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const needsPagination = sortedRows.length > rowsPerPage;
  
  const paginatedRows = useMemo(() => {
    if (!needsPagination) {
      return sortedRows;
    }
    const start = currentPage * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedRows.slice(start, end);
  }, [sortedRows, currentPage, needsPagination]);

  // Handle column header click for sorting
  const handleHeaderClick = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
    // Reset to first page when sorting changes
    setCurrentPage(0);
  };

  // Render sort indicator
  const renderSortIndicator = (columnIndex: number) => {
    if (sortColumn !== columnIndex) {
      return (
        <span className="ml-1 text-gray-400 dark:text-stone-600">
          <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z" />
          </svg>
        </span>
      );
    }

    if (sortDirection === 'asc') {
      return (
        <span className="ml-1 text-blue-600 dark:text-amber-400">
          <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 12l5-5 5 5H5z" />
          </svg>
        </span>
      );
    }

    if (sortDirection === 'desc') {
      return (
        <span className="ml-1 text-blue-600 dark:text-amber-400">
          <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 8l5 5 5-5H5z" />
          </svg>
        </span>
      );
    }

    return null;
  };

  return (
    <div className="my-4">
      {/* Horizontal scroll container for wide tables */}
      <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-stone-700">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-stone-700">
          <thead className="bg-gray-100 dark:bg-stone-800">
            <tr>
              {headers.map((header, index) => {
                const isIndexColumn = index < indexColumns;
                const indexLevel = isIndexColumn ? index : -1;
                const paddingLeft = indexLevel > 0 ? `${indexLevel * 1.5}rem` : undefined;
                
                return (
                  <th
                    key={index}
                    onClick={disableSorting ? undefined : () => handleHeaderClick(index)}
                    style={paddingLeft ? { paddingLeft } : undefined}
                    className={`px-4 py-3 text-left text-sm font-semibold transition-colors select-none ${
                      isIndexColumn
                        ? 'text-gray-900 dark:text-stone-200 bg-gray-200 dark:bg-stone-700 border-r-2 border-gray-300 dark:border-stone-600'
                        : `text-gray-900 dark:text-stone-100 ${
                            disableSorting ? '' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-stone-700'
                          }`
                    }`}
                    title={disableSorting || isIndexColumn ? undefined : "Click to sort"}
                  >
                    <div className="flex items-center">
                      <span>{header}</span>
                      {!disableSorting && !isIndexColumn && renderSortIndicator(index)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-stone-900 divide-y divide-gray-200 dark:divide-stone-800">
            {paginatedRows.map((row, rowIndex) => {
              // Calculate actual row index in sorted data for group detection
              const actualRowIndex = currentPage * rowsPerPage + rowIndex;
              const groupIndex = indexGroups ? indexGroups[actualRowIndex] : null;
              const prevGroupIndex = actualRowIndex > 0 && indexGroups ? indexGroups[actualRowIndex - 1] : null;
              const isNewGroup = groupIndex !== null && groupIndex !== prevGroupIndex;
              
              return (
                <tr
                  key={rowIndex}
                  className={`hover:bg-gray-50 dark:hover:bg-stone-800/50 transition-colors ${
                    isNewGroup ? 'border-t-2 border-gray-400 dark:border-stone-600' : ''
                  }`}
                >
                  {row.map((cell, cellIndex) => {
                    const isIndexColumn = cellIndex < indexColumns;
                    const indexLevel = isIndexColumn ? cellIndex : -1;
                    const paddingLeft = indexLevel > 0 ? `${indexLevel * 1.5}rem` : undefined;
                    
                    return (
                      <td
                        key={cellIndex}
                        style={paddingLeft ? { paddingLeft } : undefined}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${
                          isIndexColumn
                            ? 'font-medium text-gray-900 dark:text-stone-200 bg-gray-50 dark:bg-stone-800/30 border-r-2 border-gray-300 dark:border-stone-600'
                            : 'text-gray-700 dark:text-stone-300'
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {needsPagination && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-stone-400">
            Showing {currentPage * rowsPerPage + 1} to{' '}
            {Math.min((currentPage + 1) * rowsPerPage, sortedRows.length)} of{' '}
            {sortedRows.length} rows
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    currentPage === i
                      ? 'bg-amber-600 dark:bg-amber-900 text-white border-amber-600 dark:border-amber-900'
                      : 'border-gray-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
