/**
 * Callout Block Component
 * 
 * Renders Quarto-style callout blocks with type-specific styling.
 * Supports note, warning, tip, and important types with custom titles
 * and collapsible functionality.
 */

'use client';

import React, { useState } from 'react';

export type CalloutType = 'note' | 'warning' | 'tip' | 'important';

interface CalloutBlockProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * Get icon for callout type
 */
function getCalloutIcon(type: CalloutType): string {
  switch (type) {
    case 'note':
      return '📝';
    case 'warning':
      return '⚠️';
    case 'tip':
      return '💡';
    case 'important':
      return '❗';
    default:
      return '📝';
  }
}

/**
 * Get default title for callout type
 */
function getDefaultTitle(type: CalloutType): string {
  switch (type) {
    case 'note':
      return 'Note';
    case 'warning':
      return 'Warning';
    case 'tip':
      return 'Tip';
    case 'important':
      return 'Important';
    default:
      return 'Note';
  }
}

/**
 * Get styling classes for callout type
 */
function getCalloutClasses(type: CalloutType): {
  container: string;
  header: string;
  border: string;
} {
  const baseClasses = {
    container: 'callout-block rounded-lg p-4 my-4',
    header: 'callout-header font-semibold flex items-center gap-2',
    border: 'border-l-4',
  };

  switch (type) {
    case 'note':
      return {
        container: `${baseClasses.container} bg-blue-50 dark:bg-blue-950 ${baseClasses.border} border-blue-500`,
        header: `${baseClasses.header} text-blue-900 dark:text-blue-100`,
        border: 'border-blue-500',
      };
    case 'warning':
      return {
        container: `${baseClasses.container} bg-yellow-50 dark:bg-yellow-950 ${baseClasses.border} border-yellow-500`,
        header: `${baseClasses.header} text-yellow-900 dark:text-yellow-100`,
        border: 'border-yellow-500',
      };
    case 'tip':
      return {
        container: `${baseClasses.container} bg-green-50 dark:bg-green-950 ${baseClasses.border} border-green-500`,
        header: `${baseClasses.header} text-green-900 dark:text-green-100`,
        border: 'border-green-500',
      };
    case 'important':
      return {
        container: `${baseClasses.container} bg-red-50 dark:bg-red-950 ${baseClasses.border} border-red-500`,
        header: `${baseClasses.header} text-red-900 dark:text-red-100`,
        border: 'border-red-500',
      };
    default:
      return {
        container: `${baseClasses.container} bg-gray-50 dark:bg-gray-950 ${baseClasses.border} border-gray-500`,
        header: `${baseClasses.header} text-gray-900 dark:text-gray-100`,
        border: 'border-gray-500',
      };
  }
}

/**
 * CalloutBlock component
 * 
 * Renders a styled callout block with optional collapsible functionality.
 */
export function CalloutBlock({
  type,
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: CalloutBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const classes = getCalloutClasses(type);
  const icon = getCalloutIcon(type);
  const displayTitle = title || getDefaultTitle(type);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={`${classes.container} callout-${type}`}>
      <div
        className={`${classes.header} ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={toggleCollapse}
      >
        <span className="callout-icon text-xl">{icon}</span>
        <span className="callout-title">{displayTitle}</span>
        {collapsible && (
          <span className="ml-auto text-sm">
            {isCollapsed ? '▶' : '▼'}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <div className="callout-content mt-2 text-gray-800 dark:text-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}
