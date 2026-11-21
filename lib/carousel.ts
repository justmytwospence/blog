export interface CarouselLayout {
  /** Width classes for one slide. */
  slide: string;
  /** Visibility classes for the prev/next buttons. */
  arrows: string;
  /** Side padding that makes room for the buttons, at the breakpoints where they show. */
  frame: string;
}

/**
 * Classes for a home-page carousel of `count` cards that shows 1 column on phones, 2 from `sm`,
 * 3 from `md` and, when `maxColumns` is 4, 4 from `lg` (never more columns than cards). Arrows and
 * their gutters appear only at breakpoints where the cards overflow; phones swipe instead.
 * Every class is a complete literal so Tailwind's scanner finds it.
 */
export function carouselLayout(count: number, maxColumns: 3 | 4): CarouselLayout {
  const slide =
    count <= 1 ? 'w-full'
    : count === 2 ? 'w-full sm:w-1/2'
    : count === 3 || maxColumns === 3 ? 'w-full sm:w-1/2 md:w-1/3'
    : 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4';
  if (count <= 2) return { slide, arrows: 'hidden', frame: '' };
  if (count === 3) return { slide, arrows: 'hidden sm:flex md:hidden', frame: 'sm:px-12 md:px-0' };
  if (count === 4 && maxColumns === 4) return { slide, arrows: 'hidden sm:flex lg:hidden', frame: 'sm:px-12 lg:px-0' };
  return { slide, arrows: 'hidden sm:flex', frame: 'sm:px-12' };
}
