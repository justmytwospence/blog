/**
 * Custom React hooks for the blog
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect if a media query matches.
 * Useful for responsive behavior that can't be handled with CSS alone.
 * 
 * @param query - CSS media query string (e.g., '(min-width: 640px)')
 * @returns boolean indicating if the query matches
 * 
 * @example
 * const isDesktop = useMediaQuery('(min-width: 640px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with null to indicate "not yet determined"
  // This prevents any flash of incorrect content
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if window is available (client-side)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    // Default to false during static generation
    return false;
  });

  useEffect(() => {
    // Ensure we're on the client
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // Update state to match current value
    setMatches(mediaQuery.matches);

    // Create listener for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
