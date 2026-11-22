import { carouselLayout, carouselOptions } from '../carousel';

describe('carouselLayout', () => {
  it('hides arrows and gutters when every card fits', () => {
    for (const count of [1, 2]) {
      for (const max of [3, 4] as const) {
        expect(carouselLayout(count, max)).toMatchObject({
          arrows: 'hidden',
          frame: '',
          viewport: 'overflow-hidden',
          track: 'flex -ml-6',
        });
      }
    }
  });

  it('shows arrows only below the breakpoint where three cards fit', () => {
    for (const max of [3, 4] as const) {
      expect(carouselLayout(3, max)).toMatchObject({ arrows: 'hidden sm:flex md:hidden', frame: 'sm:px-12 md:px-0' });
    }
  });

  it('stops at lg when four cards fill four columns', () => {
    expect(carouselLayout(4, 4).arrows).toBe('hidden sm:flex lg:hidden');
    expect(carouselLayout(4, 3).arrows).toBe('hidden sm:flex');
  });

  it('keeps arrows from sm up when cards always overflow', () => {
    expect(carouselLayout(6, 3)).toMatchObject({ arrows: 'hidden sm:flex', frame: 'sm:px-12' });
    expect(carouselLayout(5, 4)).toMatchObject({ arrows: 'hidden sm:flex', frame: 'sm:px-12' });
  });

  it('never asks for more columns than cards', () => {
    const peek = 'w-[82%] pl-1.5 pr-1.5 sm:w-1/2 sm:pl-6 sm:pr-0 md:w-1/3';
    expect(carouselLayout(1, 3).slide).toBe('w-full pl-6');
    expect(carouselLayout(2, 4).slide).toBe('w-full pl-6 sm:w-1/2');
    expect(carouselLayout(3, 4).slide).toBe(peek);
    expect(carouselLayout(9, 3).slide).toBe(peek);
    expect(carouselLayout(4, 4).slide).toMatch(/lg:w-1\/4$/);
  });

  it('bleeds and centers on phones from three cards', () => {
    expect(carouselLayout(3, 3)).toMatchObject({ viewport: '-mx-4 overflow-hidden sm:mx-0', track: 'flex sm:-ml-6' });
    expect(carouselOptions(3)).toEqual({
      loop: true,
      slidesToScroll: 1,
      align: 'center',
      breakpoints: { '(min-width: 640px)': { align: 'start' } },
    });
    expect(carouselOptions(2)).toEqual({ loop: true, slidesToScroll: 1, align: 'start' });
  });
});
