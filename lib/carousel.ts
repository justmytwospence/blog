export interface CarouselLayout {
  /** Width classes for one slide. */
  slide: string;
  /** Classes for the Embla viewport; below sm it bleeds to the screen edges when cards peek. */
  viewport: string;
  /** Classes for the flex track inside the viewport. */
  track: string;
  /** Visibility classes for the prev/next buttons. */
  arrows: string;
  /** Side padding that makes room for the buttons, at the breakpoints where they show. */
  frame: string;
}

/**
 * Classes for a home-page carousel of `count` cards that shows 1 column on phones (one centered card with both neighbours peeking when there are 3+), 2 from `sm`,
 * 3 from `md` and, when `maxColumns` is 4, 4 from `lg` (never more columns than cards). Arrows and
 * their gutters appear only at breakpoints where the cards overflow; phones swipe instead.
 * Every class is a complete literal so Tailwind's scanner finds it.
 */
export function carouselLayout(count: number, maxColumns: 3 | 4): CarouselLayout {
  if (count <= 2) {
    return {
      viewport: 'overflow-hidden',
      track: 'flex -ml-6',
      slide: count === 2 ? 'w-full pl-6 sm:w-1/2' : 'w-full pl-6',
      arrows: 'hidden',
      frame: '',
    };
  }
  // Three or more: on phones one card is centered (82% wide) with both neighbours peeking; the
  // gutter is symmetric there, and from sm up it is the usual left padding with a negative track margin.
  const viewport = '-mx-4 overflow-hidden sm:mx-0';
  const track = 'flex sm:-ml-6';
  const slide =
    count === 3 || maxColumns === 3
      ? 'w-[82%] pl-1.5 pr-1.5 sm:w-1/2 sm:pl-6 sm:pr-0 md:w-1/3'
      : 'w-[82%] pl-1.5 pr-1.5 sm:w-1/2 sm:pl-6 sm:pr-0 md:w-1/3 lg:w-1/4';
  if (count === 3) return { viewport, track, slide, arrows: 'hidden sm:flex md:hidden', frame: 'sm:px-12 md:px-0' };
  if (count === 4 && maxColumns === 4) return { viewport, track, slide, arrows: 'hidden sm:flex lg:hidden', frame: 'sm:px-12 lg:px-0' };
  return { viewport, track, slide, arrows: 'hidden sm:flex', frame: 'sm:px-12' };
}

/** Embla options: centered on phones (where 3+ cards peek on both sides), left-aligned from sm up. */
export function carouselOptions(count: number) {
  if (count >= 3) {
    return {
      loop: true,
      slidesToScroll: 1,
      align: 'center' as const,
      breakpoints: { '(min-width: 640px)': { align: 'start' as const } },
    };
  }
  return { loop: true, slidesToScroll: 1, align: 'start' as const };
}
