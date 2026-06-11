/**
 * Table of Contents Component
 * 
 * Renders an interactive, hierarchical table of contents for Jupyter notebooks.
 * Features:
 * - Hierarchical navigation structure based on markdown headings
 * - Collapsible sections with expand/collapse icons
 * - Smooth scroll to heading on click
 * - Highlights current section based on scroll position
 * - Sticky positioning on large screens
 * - Hidden on small screens (responsive)
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

'use client';

import React from 'react';
import type { TocEntry } from '@blog/notebook-parser/types';
import { useTocNavigation, formatTocMarkdown } from './useTocNavigation';

interface TableOfContentsProps {
  /** Table of contents entries generated from notebook headings */
  entries: TocEntry[];
  /** Optional CSS class name for the container */
  className?: string;
  /** Layout variant: 'sidebar' (default) or 'header' for horizontal layout */
  variant?: 'sidebar' | 'header';
  /** Callback when navigating (for closing header TOC) */
  onNavigate?: () => void;
}

/**
 * Recursively render TOC entries with collapsible sections
 */
function TocEntryItem({
  entry,
  activeId,
  collapsedIds,
  onToggleCollapse,
  onNavigate,
  level = 0,
}: {
  entry: TocEntry;
  activeId: string | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onNavigate: (id: string) => void;
  level?: number;
}) {
  const hasChildren = entry.children.length > 0;
  const isCollapsed = collapsedIds.has(entry.id);
  const isActive = activeId === entry.id;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(entry.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleCollapse(entry.id);
  };

  return (
    <li className="toc-entry">
      <div
        className={`
          flex items-start gap-2 py-1 px-2 rounded cursor-pointer
          hover:bg-gray-100 dark:hover:bg-stone-800
          transition-colors duration-150
          ${isActive ? 'bg-blue-50 dark:bg-amber-900/20 text-blue-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-stone-300'}
        `}
        style={{ paddingLeft: `${level * 0.75}rem` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 dark:text-stone-400 hover:text-gray-700 dark:hover:text-stone-200 cursor-pointer"
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <a
          href={`#${entry.id}`}
          onClick={(e) => e.preventDefault()}
          className="flex-1 text-sm leading-tight"
        >
          {formatTocMarkdown(entry.text)}
        </a>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="toc-children mt-1">
          {entry.children.map((child) => (
            <TocEntryItem
              key={child.id}
              entry={child}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * TableOfContents component
 * 
 * Renders an interactive table of contents with:
 * - Hierarchical structure
 * - Collapsible sections
 * - Smooth scrolling navigation
 * - Active section highlighting
 * - Sticky positioning on large screens
 */
export function TableOfContents({ entries, className = '', variant = 'sidebar', onNavigate }: TableOfContentsProps) {
  const { activeId, collapsedIds, toggleCollapse, navigate } = useTocNavigation(
    entries,
    onNavigate,
  );

  // Don't render if no entries
  if (entries.length === 0) {
    return null;
  }

  return (
    <nav
      className={`
        table-of-contents
        ${className}
        bg-white dark:bg-stone-900
        border border-gray-200 dark:border-stone-700
        rounded-lg
        shadow-sm
        flex flex-col
        ${variant === 'header' ? 'max-h-[30vh]' : ''}
      `}
      aria-label="Table of contents"
    >
      <h2 className="text-sm font-semibold p-4 pb-3 text-gray-900 dark:text-stone-100 shrink-0">
        Contents
      </h2>
      <div className="flex-1 overflow-y-auto toc-sidebar-scroll px-4 pb-4 min-h-0">
        <ul className="toc-list space-y-1">
          {entries.map((entry) => (
            <TocEntryItem
              key={entry.id}
              entry={entry}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggleCollapse={toggleCollapse}
              onNavigate={navigate}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}
