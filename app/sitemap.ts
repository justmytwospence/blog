import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { getAllBlogPosts, getAllProjects, getAllConcepts } from '@/lib/content';
import { getAllAdventureRefs } from '@/lib/adventures';

function when(date?: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/about',
    '/adventures',
    '/adventures/objectives',
    '/blog',
    '/projects',
    '/concepts',
    '/blogroll',
    '/reading',
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.6,
  }));

  const adventures: MetadataRoute.Sitemap = getAllAdventureRefs().map((a) => ({
    url: `${SITE_URL}/adventures/${a.slug}`,
    lastModified: when(a.date),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const posts: MetadataRoute.Sitemap = getAllBlogPosts().map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: when(p.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const projects: MetadataRoute.Sitemap = getAllProjects().map((p) => ({
    url: `${SITE_URL}/projects/${p.slug}`,
    lastModified: when(p.date),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const concepts: MetadataRoute.Sitemap = getAllConcepts().map((c) => ({
    url: `${SITE_URL}/concepts/${c.slug}`,
    lastModified: when(c.date),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...adventures, ...posts, ...projects, ...concepts];
}
