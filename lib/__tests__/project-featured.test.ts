import fs from 'fs';
import path from 'path';
import { getFeaturedContent } from '../content';
import type { Project } from '../types';
import { byFeaturedOrder } from '../project-navigation';

const stub = (slug: string, featuredOrder?: number) => ({ slug, featuredOrder }) as Project;

describe('featured order', () => {
  it('orders by featuredOrder, unranked last', () => {
    const sorted = [stub('c'), stub('b', 2), stub('a', 1)].sort(byFeaturedOrder).map((p) => p.slug);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });
});

describe('featured projects', () => {
  const featured = getFeaturedContent().projects;

  it('features six projects in editorial order', () => {
    expect(featured.map((p) => p.slug)).toEqual(['uphill-ski', 'effort-curve', 'bikefitter', 'groundcover', 'pi-plugins', 'bayesdag']);
  });

  it('gives every featured project a hero image and a story', () => {
    for (const project of featured) {
      expect(project.image, project.slug).toMatch(/^\/project-images\/[a-z0-9-]+\.webp$/);
      expect(fs.existsSync(path.join(process.cwd(), 'public', project.image!)), project.slug).toBe(true);
      expect(project.imageAlt, project.slug).toBeTruthy();
      expect(project.hasBody, project.slug).toBe(true);
    }
  });
});
