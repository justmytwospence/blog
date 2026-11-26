import { useEffect, type RefObject } from 'react';

/**
 * A sticky sidebar taller than the viewport scrolls with the page instead of inside itself: it
 * pins at its top edge while you scroll up and at its bottom edge while you scroll down, so every
 * entry is reachable without an inner scrollbar.
 *
 * The element's CSS sets `top: calc(<offset> + var(--sticky-shift, 0px))`; this keeps
 * `--sticky-shift` between 0 (top edge pinned under the nav) and the negative overflow
 * (bottom edge pinned `gap` above the viewport bottom).
 */

/** Lowest shift: how far above its offset the sidebar must rise for its bottom edge to show. */
export function minStickyShift(viewportHeight: number, offset: number, height: number, gap: number): number {
  return Math.min(0, viewportHeight - offset - height - gap);
}

/** The shift after the page scrolls by `delta` pixels (positive is down). */
export function nextStickyShift(shift: number, delta: number, min: number): number {
  return Math.min(0, Math.max(min, shift - delta));
}

export function followStickyScroll(element: HTMLElement, gap = 16): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => {};
  let shift = 0;
  let lastY = view.scrollY;
  let frame = 0;

  const apply = (delta: number) => {
    const top = Number.parseFloat(view.getComputedStyle(element).top);
    // Not sticky at this width (top resolves to auto): leave the element alone.
    if (Number.isNaN(top)) {
      if (shift !== 0) element.style.setProperty('--sticky-shift', '0px');
      shift = 0;
      return;
    }
    const offset = top - shift;
    const min = minStickyShift(view.innerHeight, offset, element.getBoundingClientRect().height, gap);
    // Whole pixels: sub-pixel layout noise would otherwise rewrite the style on every scroll.
    const next = Math.round(nextStickyShift(shift, delta, min));
    if (next !== shift) {
      shift = next;
      element.style.setProperty('--sticky-shift', `${shift}px`);
    }
  };
  const onScroll = () => {
    const y = view.scrollY;
    const delta = y - lastY;
    lastY = y;
    apply(delta);
  };
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => apply(0));
  };

  view.addEventListener('scroll', onScroll, { passive: true });
  view.addEventListener('resize', onResize);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize);
  observer?.observe(element);
  apply(0);
  return () => {
    cancelAnimationFrame(frame);
    view.removeEventListener('scroll', onScroll);
    view.removeEventListener('resize', onResize);
    observer?.disconnect();
    element.style.removeProperty('--sticky-shift');
  };
}

export function useStickyScroll(ref: RefObject<HTMLElement | null>, gap?: number): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return followStickyScroll(element, gap);
  }, [ref, gap]);
}
