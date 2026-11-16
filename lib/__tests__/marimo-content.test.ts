import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarimoDocument } from 'marimo-blog';

const digest = 'a'.repeat(64);
const document = (slug: string): MarimoDocument => ({
  schemaVersion: 1,
  metadata: { slug, title: 'Published analysis', date: '2025-11-25', description: 'Executed results', tags: ['research'], featured: true },
  provenance: { exporterVersion: '0.25.2', notebookVersion: '1', sessionVersion: '1', inputSha256: digest, publicationConfigSha256: digest, producerVersion: '0.1.0', sourceHashes: {} },
  assetBase: `/notebooks/${slug}/assets`, cells: [], toc: [],
  plainText: 'A small publication about research and graphs.', assets: [], diagnostics: [],
});

let root: string;
let cwd: ReturnType<typeof vi.spyOn>;
async function content() {
  vi.resetModules();
  return import('../content');
}
function put(section: 'blog' | 'projects', file: string, body: string) {
  fs.writeFileSync(path.join(root, 'content', section, file), body);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'marimo-content-'));
  fs.mkdirSync(path.join(root, 'content', 'blog'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content', 'projects'));
  cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
});
afterEach(() => {
  cwd.mockRestore();
  fs.rmSync(root, { recursive: true, force: true });
  vi.resetModules();
});

describe('marimo content discovery', () => {
  it('loads blog and project manifests by their complete extension, mapping tags and semantic reading time', async () => {
    put('blog', 'analysis.marimo.json', JSON.stringify(document('analysis')));
    put('blog', 'analysis.marimo.yaml', 'uncompiled authoring configuration');
    put('blog', 'old.ipynb', 'not a publication');
    put('projects', 'project.marimo.json', JSON.stringify(document('project')));
    put('projects', 'app.json', JSON.stringify({ title: 'App', date: '2025-01-01', url: 'https://example.com' }));
    const { getAllBlogPosts, getBlogPostBySlug, getAllProjects, getProjectBySlug } = await content();
    expect(getAllBlogPosts()).toEqual([expect.objectContaining({ slug: 'analysis', type: 'marimo', categories: ['research'], date: '2025-11-25', readingTime: 1, featured: true })]);
    const post = getBlogPostBySlug('analysis');
    expect(post?.type).toBe('marimo');
    if (post?.type === 'marimo') expect(post.document.plainText).toContain('research');
    expect(getBlogPostBySlug('old')).toBeNull();
    expect(getAllProjects().map(project => [project.slug, project.type])).toEqual([['project', 'marimo'], ['app', 'webapp']]);
    expect(getProjectBySlug('project')?.metadata.categories).toEqual(['research']);
    expect(getProjectBySlug('app')?.type).toBe('webapp');
  });

  it('reads the comments thread from host extra metadata', async () => {
    const withExtra = (extra: Record<string, unknown>) => ({ ...document('analysis'), metadata: { ...document('analysis').metadata, extra } });
    put('blog', 'analysis.marimo.json', JSON.stringify(withExtra({ bluesky: 'https://bsky.app/profile/a/post/b' })));
    const first = await content();
    expect(first.getBlogPostBySlug('analysis')?.metadata.bluesky).toBe('https://bsky.app/profile/a/post/b');
    put('blog', 'analysis.marimo.json', JSON.stringify(withExtra({ bluesky: 3 })));
    const second = await content();
    expect(second.getBlogPostBySlug('analysis')?.metadata.bluesky).toBeUndefined();
  });

  it('preserves Markdown and project links without treating YAML as content', async () => {
    put('blog', 'article.md', '---\ntitle: Article\ndate: 2024-01-01\n---\nHello world');
    put('projects', 'link.md', '---\ntitle: Link\ndate: 2024-01-01\nexternalUrl: https://example.com\n---\nLink body');
    const { getAllBlogPosts, getProjectBySlug } = await content();
    expect(getAllBlogPosts().map(post => post.type)).toEqual(['markdown']);
    expect(getProjectBySlug('link')?.type).toBe('link');
  });

  it('rejects duplicate slugs in both catalogs and detail readers', async () => {
    for (const section of ['blog', 'projects'] as const) {
      put(section, 'same.marimo.json', JSON.stringify(document('same')));
      put(section, 'same.md', '---\ntitle: Same\ndate: 2024-01-01\n---\nText');
    }
    const { getAllBlogPosts, getBlogPostBySlug, getAllProjects, getProjectBySlug } = await content();
    expect(getAllBlogPosts).toThrow(/Duplicate content slug "same"/);
    expect(() => getBlogPostBySlug('same')).toThrow(/Duplicate content slug "same"/);
    expect(getAllProjects).toThrow(/Duplicate content slug "same"/);
    expect(() => getProjectBySlug('same')).toThrow(/Duplicate content slug "same"/);
  });

  it('rejects malformed, missing, mismatched and unsafe manifests instead of skipping them', async () => {
    const { getAllBlogPosts, getBlogPostBySlug, getAllProjects } = await content();
    expect(getBlogPostBySlug('missing')).toBeNull();
    put('blog', 'broken.marimo.json', '{');
    expect(getAllBlogPosts).toThrow();
    fs.rmSync(path.join(root, 'content', 'blog', 'broken.marimo.json'));
    put('blog', 'wrong.marimo.json', JSON.stringify(document('different')));
    expect(getAllBlogPosts).toThrow(/slug mismatch/);
    expect(() => getBlogPostBySlug('wrong')).toThrow(/slug mismatch/);
    const unsafe = { ...document('unsafe'), assets: [{ path: '../secret', mime: 'text/plain', sha256: digest, bytes: 1 }] };
    put('projects', 'unsafe.marimo.json', JSON.stringify(unsafe));
    expect(getAllProjects).toThrow(/MB_SCHEMA: Invalid asset path|Unsafe marimo asset path/);
  });

  it('never executes saved notebook source and rejects unknown manifest fields', async () => {
    const marker = path.join(root, 'executed');
    const safe = document('safe');
    safe.cells = [{ id: 'cell', ordinal: 0, source: `require('fs').writeFileSync('${marker}', 'bad')`, sourceLanguage: 'python', hideCode: false, disabled: false, code: 'folded', console: 'collapsed', outputs: [], consoleOutputs: [] }];
    put('blog', 'safe.marimo.json', JSON.stringify(safe));
    const { getAllBlogPosts } = await content();
    expect(getAllBlogPosts()).toHaveLength(1);
    expect(fs.existsSync(marker)).toBe(false);
    put('blog', 'safe.marimo.json', JSON.stringify({ ...safe, injected: 'unexpected' }));
    expect(getAllBlogPosts).toThrow();
    expect(fs.existsSync(marker)).toBe(false);
  });
});
