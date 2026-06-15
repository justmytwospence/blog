'use client';

import { useEffect } from 'react';
import { useHoverStore } from './hoverStore';

/**
 * Clears the shared hover index on report mount/unmount, so a report never inherits a
 * stale cursor position from a previously viewed (longer) report across client navigation.
 */
export function HoverReset() {
  useEffect(() => {
    const reset = () => useHoverStore.getState().setHoverIndex(-1);
    reset();
    return reset;
  }, []);
  return null;
}
