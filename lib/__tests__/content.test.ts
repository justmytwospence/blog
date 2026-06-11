/**
 * Contract tests for lib/content.ts against the real content/ directory.
 *
 * These lock in the invariants the metadata pipeline must preserve:
 * list functions and by-slug functions agree, lists are sorted, and
 * unknown slugs resolve to null. They double as content validation.
 */

import {
  getAllProjects,
  getAllBlogPosts,
  getAllConcepts,
  getProjectBySlug,
  getBlogPostBySlug,
  getConceptBySlug,
} from '../content';

function isSortedDescending(dates: (string | Date)[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (new Date(dates[i - 1]).getTime() < new Date(dates[i]).getTime()) {
      return false;
    }
  }
  return true;
}

describe('getAllBlogPosts', () => {
  const posts = getAllBlogPosts();

  it('returns at least one post', () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it('sorts posts by date, newest first', () => {
    expect(isSortedDescending(posts.map((p) => p.date))).toBe(true);
  });

  it('gives every post a slug, title, parseable date, and reading time', () => {
    for (const post of posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(Number.isNaN(new Date(post.date).getTime())).toBe(false);
      expect(post.readingTime).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('getAllProjects', () => {
  const projects = getAllProjects();

  it('returns at least one project', () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  it('sorts projects by date, newest first', () => {
    expect(isSortedDescending(projects.map((p) => p.date))).toBe(true);
  });

  it('gives every project a slug, title, and parseable date', () => {
    for (const project of projects) {
      expect(project.slug).toBeTruthy();
      expect(project.title).toBeTruthy();
      expect(Number.isNaN(new Date(project.date).getTime())).toBe(false);
    }
  });
});

describe('getAllConcepts', () => {
  const concepts = getAllConcepts();

  it('gives every concept a slug, title, and component', () => {
    for (const concept of concepts) {
      expect(concept.slug).toBeTruthy();
      expect(concept.title).toBeTruthy();
      expect(concept.component).toBeTruthy();
    }
  });
});

describe('list/by-slug round trip', () => {
  it('resolves every blog post slug with matching metadata', () => {
    for (const post of getAllBlogPosts()) {
      const full = getBlogPostBySlug(post.slug);
      expect(full).not.toBeNull();
      expect(full!.metadata.title).toBe(post.title);
      expect(String(full!.metadata.date)).toBe(String(post.date));
      expect(full!.metadata.categories).toEqual(post.categories);
      expect(full!.metadata.description).toBe(post.description);
    }
  });

  it('resolves every project slug with matching metadata', () => {
    for (const project of getAllProjects()) {
      const full = getProjectBySlug(project.slug);
      expect(full).not.toBeNull();
      expect(full!.metadata.title).toBe(project.title);
      expect(String(full!.metadata.date)).toBe(String(project.date));
      expect(full!.metadata.categories).toEqual(project.categories);
    }
  });

  it('resolves every concept slug with matching metadata', () => {
    for (const concept of getAllConcepts()) {
      const full = getConceptBySlug(concept.slug);
      expect(full).not.toBeNull();
      expect(full!.metadata.title).toBe(concept.title);
      expect(full!.component).toBe(concept.component);
    }
  });
});

describe('content type discrimination', () => {
  it('returns a link project with externalUrl for vertfarmer', () => {
    const content = getProjectBySlug('vertfarmer');
    expect(content).not.toBeNull();
    expect(content!.type).toBe('link');
    expect(content!.metadata.externalUrl).toMatch(/^https:/);
  });

  it('returns a notebook project with notebook data for kcore', () => {
    const content = getProjectBySlug('kcore');
    expect(content).not.toBeNull();
    expect(content!.type).toBe('notebook');
    if (content!.type === 'notebook') {
      expect(content!.notebookData.cells.length).toBeGreaterThan(0);
    }
  });
});

describe('unknown slugs', () => {
  it('returns null instead of throwing', () => {
    expect(getBlogPostBySlug('does-not-exist')).toBeNull();
    expect(getProjectBySlug('does-not-exist')).toBeNull();
    expect(getConceptBySlug('does-not-exist')).toBeNull();
  });
});
