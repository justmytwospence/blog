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

import React, { useState, useEffect, useCallback } from 'react';
import type { TocEntry } from '@/lib/notebook/types';

interface TableOfContentsProps {
  /** Table of contents entries generated from notebook headings */
  entries: TocEntry[];
  /** Optional CSS class name for the container */
  className?: string;
}

/**
 * Format markdown text (bold and italic) to JSX
 */
function formatMarkdown(text: string): React.ReactNode {
  // Split by bold (**text**)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  // Process bold and italic patterns
  const boldPattern = /\*\*(.+?)\*\*/g;
  const italicPattern = /\*(.+?)\*/g;
  
  // First pass: handle bold
  const boldParts = remaining.split(boldPattern);
  
  for (let i = 0; i < boldParts.length; i++) {
    if (i % 2 === 0) {
      // Not bold - check for italic
      const italicParts = boldParts[i].split(italicPattern);
      for (let j = 0; j < italicParts.length; j++) {
        if (j % 2 === 0) {
          // Plain text
          if (italicParts[j]) {
            parts.push(italicParts[j]);
          }
        } else {
          // Italic
          parts.push(<em key={`em-${key++}`}>{italicParts[j]}</em>);
        }
      }
    } else {
      // Bold text
      parts.push(<strong key={`strong-${key++}`}>{boldParts[i]}</strong>);
    }
  }
  
  return parts.length > 0 ? parts : text;
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
          {formatMarkdown(entry.text)}
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
export function TableOfContents({ entries, className = '' }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  /**
   * Toggle collapse state for a TOC entry
   */
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Navigate to a heading with smooth scroll
   * Dynamically accounts for fixed navbar height + padding
   */
  const handleNavigate = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Get the navbar height dynamically
      const navbar = document.querySelector('nav');
      const navbarHeight = navbar ? navbar.offsetHeight : 65;
      const padding = 20; // Additional padding for breathing room
      const offset = navbarHeight + padding;
      
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update URL hash without triggering scroll
      window.history.pushState(null, '', `#${id}`);
    }
  }, []);

  /**
   * Track scroll position and highlight current section
   */
  useEffect(() => {
    // Collect all heading IDs in order
    const headingIds: string[] = [];
    const collectIds = (entries: TocEntry[]) => {
      entries.forEach((entry) => {
        headingIds.push(entry.id);
        if (entry.children.length > 0) {
          collectIds(entry.children);
        }
      });
    };
    collectIds(entries);

    if (headingIds.length === 0) {
      return;
    }

    /**
     * Find the currently visible heading based on scroll position
     */
    const updateActiveHeading = () => {
      // Get all heading elements
      const headingElements = headingIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) {
        return;
      }

      // Find the heading that is currently in view
      // We consider a heading "active" if it's above the middle of the viewport
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      let currentId = headingIds[0];
      for (let i = 0; i < headingElements.length; i++) {
        const element = headingElements[i];
        if (element.offsetTop <= scrollPosition) {
          currentId = headingIds[i];
        } else {
          break;
        }
      }

      setActiveId(currentId);
    };

    // Update on scroll
    window.addEventListener('scroll', updateActiveHeading, { passive: true });
    
    // Initial update
    updateActiveHeading();

    return () => {
      window.removeEventListener('scroll', updateActiveHeading);
    };
  }, [entries]);

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
              onToggleCollapse={handleToggleCollapse}
              onNavigate={handleNavigate}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}
