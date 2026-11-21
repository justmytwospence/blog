import type { Project } from '../types';
import { byFeaturedOrder } from '../project-navigation';

const stub = (slug: string, featuredOrder?: number) => ({ slug, featuredOrder }) as Project;

describe('featured order', () => {
  it('orders by featuredOrder, unranked last', () => {
    const sorted = [stub('c'), stub('b', 2), stub('a', 1)].sort(byFeaturedOrder).map((p) => p.slug);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });
});
