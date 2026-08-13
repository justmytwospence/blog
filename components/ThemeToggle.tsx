'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { nextThemeSetting, type Appearance } from '@/lib/theme';

interface ThemeToggleProps {
  /** Use 'mobile' for bottom nav bar style (icon + label, no background) */
  variant?: 'default' | 'mobile';
}

/** Icon paths, keyed by the appearance the icon depicts. */
const OUTLINE_PATHS: Record<Appearance, string> = {
  light:
    'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  dark: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
};

const SOLID_PATHS: Record<Appearance, string> = {
  light:
    'M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z',
  dark: 'M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z',
};

/** Solid icons carry their own colour; the outline set inherits from the nav link. */
const SOLID_COLOR: Record<Appearance, string> = {
  light: 'text-yellow-500',
  dark: 'text-gray-300',
};

/**
 * Two-state toggle over a three-state model, following Lea Verou's
 * "Dark mode toggles should be two-state" (https://lea.verou.me/blog/2026/dark-mode-toggles/).
 *
 * The stored setting still has three values — `light`, `dark`, `system` — but only two are ever
 * offered, because the third answers a question the user does not currently have. Nobody opens a
 * page that looks fine and goes hunting for a theme control; they reach for it when the page is too
 * bright or too dark *right now*. A tri-state control makes them choose between two options that
 * produce no visible difference, which is why the old system/light/dark cycle is gone.
 *
 * Three states stay reachable through two controls by these rules:
 *
 *  - A click targets the OPPOSITE of what is currently on screen.
 *  - If that target is what the OS already asks for, the override is DROPPED (back to `system`)
 *    rather than pinned. Storing a value that merely happens to agree with the OS is what makes a
 *    bad two-state toggle irreversible: it silently converts a momentary adjustment into a
 *    permanent pin with no way back to following the OS.
 *  - Otherwise the target is stored as an explicit override.
 *
 * That comparison happens ONLY on a click. An override is never tidied away just because the OS
 * later drifted into agreeing with it — many people have the OS switch on a schedule, and clearing
 * their pin on an event they did not cause and cannot see would make a pinned theme unholdable.
 */
export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { resolvedTheme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // `resolvedTheme` is what is actually on screen — it collapses `system` to the light/dark it
  // currently resolves to, which is precisely the state a two-state control operates on. (`theme`,
  // the stored setting, is the three-state model and is deliberately not surfaced.)
  const current: Appearance = resolvedTheme === 'dark' ? 'dark' : 'light';
  const target: Appearance = current === 'dark' ? 'light' : 'dark';

  // `systemTheme` is typed as a free string by next-themes; narrow it before applying the rule.
  const osPreference: Appearance | undefined =
    systemTheme === 'dark' || systemTheme === 'light' ? systemTheme : undefined;

  // Drop the override when the target is already the OS preference; pin it otherwise (lib/theme.ts).
  const toggleTheme = () => setTheme(nextThemeSetting(current, osPreference));

  // The icon shows the target, not the current state: with two states the control is an action, and
  // an action icon says what the click will do.
  const label = `Switch to ${target} theme`;

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
        onClick={toggleTheme}
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
            d={OUTLINE_PATHS[target]}
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
      onClick={toggleTheme}
      data-testid="theme-toggle"
      data-theme-mode={current}
      className="p-2 rounded-lg bg-gray-200 dark:bg-[#252526] hover:bg-gray-300 dark:hover:bg-[#3a3d41] transition-colors duration-200 cursor-pointer"
      aria-label={label}
      title={label}
    >
      <svg
        className={`w-5 h-5 ${SOLID_COLOR[target]}`}
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d={SOLID_PATHS[target]} clipRule="evenodd" />
      </svg>
    </button>
  );
}
