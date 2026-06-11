/**
 * Shared TOC behavior for TableOfContents (sidebar/header) and TocDrawer
 * (mobile): active-heading tracking on scroll, collapsible sections, and
 * navbar-offset smooth-scroll navigation.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { TocEntry } from '@blog/notebook-parser/types';

/**
 * Format markdown text (bold and italic) to JSX
 */
export function formatTocMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const remaining = text;
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

export function useTocNavigation(
  entries: TocEntry[],
  onAfterNavigate?: () => void,
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
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
   * Navigate to a heading with smooth scroll, dynamically accounting for
   * the fixed navbar height plus padding.
   */
  const navigate = useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (element) {
        const navbar = document.querySelector('nav');
        const navbarHeight = navbar ? navbar.offsetHeight : 65;
        const padding = 20; // Additional padding for breathing room
        const offset = navbarHeight + padding;

        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });

        // Update URL hash without triggering scroll
        window.history.pushState(null, '', `#${id}`);

        onAfterNavigate?.();
      }
    },
    [onAfterNavigate],
  );

  // Track scroll position and highlight the current section
  useEffect(() => {
    const headingIds: string[] = [];
    const collectIds = (tocEntries: TocEntry[]) => {
      tocEntries.forEach((entry) => {
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

    const updateActiveHeading = () => {
      const headingElements = headingIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) {
        return;
      }

      // A heading is "active" once it crosses the upper third of the viewport
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

  return { activeId, collapsedIds, toggleCollapse, navigate };
}
