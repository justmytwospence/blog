'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  /** Use 'mobile' for bottom nav bar style (icon + label, no background) */
  variant?: 'default' | 'mobile';
}

/**
 * The three settings, in click order. `system` is the provider default (see app/layout.tsx) and has
 * to be reachable again after an explicit choice — a two-state light/dark flip strands you on
 * whichever you last picked, with no way back to following the OS.
 */
const MODES = ['system', 'light', 'dark'] as const;
type Mode = (typeof MODES)[number];

const MODE_LABEL: Record<Mode, string> = {
  system: 'system settings',
  light: 'light',
  dark: 'dark',
};

/**
 * Icon paths per mode. The icon shows the *current setting* rather than the one a click would
 * produce: with three states an action-icon is ambiguous, and "system" is only legible if it has a
 * face of its own.
 */
const OUTLINE_PATHS: Record<Mode, string> = {
  light:
    'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  dark: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  system:
    'M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

const SOLID_PATHS: Record<Mode, string> = {
  light:
    'M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z',
  dark: 'M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z',
  system:
    'M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z',
};

/** Solid icons carry their own colour; the outline set inherits from the nav link. */
const SOLID_COLOR: Record<Mode, string> = {
  light: 'text-yellow-500',
  dark: 'text-gray-300',
  system: 'text-gray-700 dark:text-[#a6a6a6]',
};

export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // `theme` is the stored setting ('system' included), unlike `resolvedTheme`, which collapses
  // 'system' to the light/dark it currently resolves to and so cannot drive a three-state control.
  const current: Mode = MODES.includes(theme as Mode) ? (theme as Mode) : 'system';
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];

  const cycleTheme = () => setTheme(next);
  const label = `Theme: ${MODE_LABEL[current]}. Switch to ${MODE_LABEL[next]}.`;

  // Mobile variant: matches nav link styling with icon + label
  if (variant === 'mobile') {
    if (!mounted) {
      return (
        <button
          className="flex flex-col items-center justify-center py-2 text-xs font-medium text-gray-600 dark:text-[#a6a6a6] transition-colors duration-200 cursor-pointer"
          aria-label="Toggle theme"
        >
          <div className="w-6 h-6 mb-1" />
          <span>Theme</span>
        </button>
      );
    }

    return (
      <button
        onClick={cycleTheme}
        data-testid="theme-toggle"
        data-theme-mode={current}
        className="flex flex-col items-center justify-center py-2 text-xs font-medium text-gray-600 dark:text-[#a6a6a6] transition-colors duration-200 cursor-pointer"
        aria-label={label}
      >
        <svg
          className="w-6 h-6 mb-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={OUTLINE_PATHS[current]}
          />
        </svg>
        <span>Theme</span>
      </button>
    );
  }

  // Default variant: button with background (for desktop)
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-gray-200 dark:bg-[#252526] transition-colors duration-200 cursor-pointer"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={cycleTheme}
      data-testid="theme-toggle"
      data-theme-mode={current}
      className="p-2 rounded-lg bg-gray-200 dark:bg-[#252526] hover:bg-gray-300 dark:hover:bg-[#3a3d41] transition-colors duration-200 cursor-pointer"
      aria-label={label}
      title={label}
    >
      <svg
        className={`w-5 h-5 ${SOLID_COLOR[current]}`}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d={SOLID_PATHS[current]} clipRule="evenodd" />
      </svg>
    </button>
  );
}
