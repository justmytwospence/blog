'use client';

import { useEffect } from 'react';
import { useHoverStore } from './hoverStore';

/**
 * Clears the shared hover point on report mount/unmount, so a report never inherits a
 * stale cursor position from a previously viewed (longer) report across client navigation.
 */
export function HoverReset() {
  useEffect(() => {
    const reset = () => useHoverStore.getState().setHover(null);
    reset();
    return reset;
  }, []);
  return null;
}
