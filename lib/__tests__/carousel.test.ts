import { carouselLayout } from '../carousel';

describe('carouselLayout', () => {
  it('hides arrows and gutters when every card fits', () => {
    for (const count of [1, 2]) {
      for (const max of [3, 4] as const) {
        expect(carouselLayout(count, max)).toMatchObject({ arrows: 'hidden', frame: '' });
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
    expect(carouselLayout(1, 3).slide).toBe('w-full');
    expect(carouselLayout(2, 4).slide).toBe('w-full sm:w-1/2');
    expect(carouselLayout(3, 4).slide).toBe('w-full sm:w-1/2 md:w-1/3');
    expect(carouselLayout(9, 3).slide).toBe('w-full sm:w-1/2 md:w-1/3');
    expect(carouselLayout(4, 4).slide).toMatch(/lg:w-1\/4$/);
  });
});
