/**
 * TocDrawer Component
 * 
 * A collapsible bottom drawer for the table of contents on mobile screens.
 * Features:
 * - Floating button trigger at bottom-right (above mobile nav)
 * - Slide-up animation when opened
 * - Max height of 60vh with overflow scroll
 * - Closes on explicit action or when navigating to a heading
 * - Includes visibility controls for code/output/line numbers
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { List, X, Eye, EyeOff, Hash } from 'lucide-react';
import type { TocEntry } from '@/lib/notebook/types';

interface TocDrawerProps {
  entries: TocEntry[];
  // Control states
  allCodeVisible: boolean;
  allOutputVisible: boolean;
  showLineNumbers: boolean;
  // Control callbacks
  onToggleAllCode: () => void;
  onToggleAllOutput: () => void;
  onToggleLineNumbers: () => void;
}

/**
 * Format markdown text (bold and italic) to JSX
 */
function formatMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  const boldPattern = /\*\*(.+?)\*\*/g;
  const italicPattern = /\*(.+?)\*/g;
  
  const boldParts = remaining.split(boldPattern);
  
  for (let i = 0; i < boldParts.length; i++) {
    if (i % 2 === 0) {
      const italicParts = boldParts[i].split(italicPattern);
      for (let j = 0; j < italicParts.length; j++) {
        if (j % 2 === 0) {
          if (italicParts[j]) {
            parts.push(italicParts[j]);
          }
        } else {
          parts.push(<em key={`em-${key++}`}>{italicParts[j]}</em>);
        }
      }
    } else {
      parts.push(<strong key={`strong-${key++}`}>{boldParts[i]}</strong>);
    }
  }
  
  return parts.length > 0 ? parts : text;
}

/**
 * Recursive TOC entry component for drawer
 */
function DrawerTocEntry({
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
    <li className="toc-drawer-entry">
      <div
        className={`
          flex items-start gap-2 py-2 px-3 rounded cursor-pointer
          hover:bg-gray-100 dark:hover:bg-stone-800
          transition-colors duration-150
          ${isActive ? 'bg-blue-50 dark:bg-amber-900/20 text-blue-700 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-stone-300'}
        `}
        style={{ paddingLeft: `${level * 0.75 + 0.75}rem` }}
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
        <ul className="toc-drawer-children">
          {entry.children.map((child) => (
            <DrawerTocEntry
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

export function TocDrawer({ 
  entries,
  allCodeVisible,
  allOutputVisible,
  showLineNumbers,
  onToggleAllCode,
  onToggleAllOutput,
  onToggleLineNumbers,
}: TocDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

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

  const handleNavigate = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navbar = document.querySelector('nav');
      const navbarHeight = navbar ? navbar.offsetHeight : 65;
      const padding = 20;
      const offset = navbarHeight + padding;
      
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      window.history.pushState(null, '', `#${id}`);
      
      // Close the drawer after navigation
      setIsOpen(false);
    }
  }, []);

  // Track scroll position for active section highlighting
  useEffect(() => {
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

    if (headingIds.length === 0) return;

    const updateActiveHeading = () => {
      const headingElements = headingIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) return;

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

    window.addEventListener('scroll', updateActiveHeading, { passive: true });
    updateActiveHeading();

    return () => {
      window.removeEventListener('scroll', updateActiveHeading);
    };
  }, [entries]);

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (entries.length === 0) return null;

  return (
    <>
      {/* Floating trigger button - positioned above mobile nav */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors cursor-pointer"
        aria-label="Open table of contents"
      >
        <List className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-white dark:bg-stone-900
          rounded-t-2xl shadow-2xl
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ maxHeight: '60vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Table of contents"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-stone-100">
            Contents
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close table of contents"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-stone-400" />
          </button>
        </div>

        {/* Drawer content */}
        <div className="overflow-y-auto toc-sidebar-scroll p-4" style={{ maxHeight: 'calc(60vh - 60px)' }}>
          {/* Controls section */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-stone-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-stone-100">
              Controls
            </h3>
            <div className="flex flex-wrap gap-2">
              {/* Toggle Code Visibility */}
              <button
                onClick={onToggleAllCode}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
                  allCodeVisible
                    ? 'bg-blue-50 dark:bg-amber-900/20 text-blue-700 dark:text-amber-400'
                    : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300'
                }`}
              >
                {allCodeVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{allCodeVisible ? 'Hide' : 'Show'} Code</span>
              </button>
              
              {/* Toggle Output Visibility */}
              <button
                onClick={onToggleAllOutput}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
                  allOutputVisible
                    ? 'bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400'
                    : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300'
                }`}
              >
                {allOutputVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{allOutputVisible ? 'Hide' : 'Show'} Output</span>
              </button>
              
              {/* Toggle Line Numbers */}
              <button
                onClick={onToggleLineNumbers}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors cursor-pointer ${
                  showLineNumbers
                    ? 'bg-purple-50 dark:bg-violet-900/20 text-purple-700 dark:text-violet-400'
                    : 'bg-gray-50 dark:bg-stone-800 text-gray-700 dark:text-stone-300'
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>{showLineNumbers ? 'Hide' : 'Show'} Line #</span>
              </button>
            </div>
          </div>
          
          {/* TOC entries */}
          {entries.length > 0 && (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <DrawerTocEntry
                  key={entry.id}
                  entry={entry}
                  activeId={activeId}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={handleToggleCollapse}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="h-safe-area-inset-bottom bg-white dark:bg-stone-900" />
      </div>
    </>
  );
}
