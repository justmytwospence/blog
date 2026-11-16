import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarimoDocument } from 'marimo-blog';

let root: string;
let cwd: ReturnType<typeof vi.spyOn>;
const digest = 'a'.repeat(64);
function manifest(slug: string): MarimoDocument {
  return {
    schemaVersion: 1,
    metadata: { slug, title: 'Analysis', date: '2025-11-25', description: 'Results', tags: ['statistics'] },
    provenance: { exporterVersion: '0.25.2', notebookVersion: '1', sessionVersion: '1', inputSha256: digest, publicationConfigSha256: digest, producerVersion: '0.1.0', sourceHashes: {} },
    assetBase: `/notebooks/${slug}/assets`,
    cells: [], toc: [], assets: [], diagnostics: [],
    plainText: 'Analysis of <unsafe> & "figures" with clear results.',
  };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'marimo-feed-'));
  fs.mkdirSync(path.join(root, 'content', 'blog'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content', 'projects'));
  cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
});
afterEach(() => {
  cwd.mockRestore();
  fs.rmSync(root, { recursive: true, force: true });
  vi.resetModules();
});

describe('marimo feeds', () => {
  it('escapes plain prose, links to the article and never embeds output, scripts or Python', async () => {
    for (const [section, slug] of [['blog', 'analysis'], ['projects', 'project']] as const) {
      const doc = manifest(slug);
      doc.assets = [{ path: `${digest}.json`, sha256: digest, mime: 'application/json', bytes: 4 }];
      doc.cells = [{ id: 'cell', ordinal: 0, source: 'secret_python_code()', sourceLanguage: 'python', hideCode: false, disabled: false, code: 'folded', console: 'collapsed', outputs: [{ type: 'plotly', asset: `${doc.assetBase}/${digest}.json`, caption: 'secret-chart-spec' }], consoleOutputs: [] }];
      fs.writeFileSync(path.join(root, 'content', section, `${slug}.marimo.json`), JSON.stringify(doc));
    }
    vi.resetModules();
    const { generateFeed } = await import('../feed');
    const feed = await generateFeed();
    const articles = feed.items.filter(item => /\/(blog|projects)\/(analysis|project)$/.test(item.link));
    expect(articles).toHaveLength(2);
    for (const article of articles) {
      expect(article.content).toContain('Analysis of &lt;unsafe&gt; &amp; &quot;figures&quot;');
      expect(article.content).toContain(`<a href="${article.link}">Read the full article`);
      expect(article.content).not.toMatch(/<script|secret_python_code|secret-chart-spec|<unsafe>/);
    }
    expect(feed.rss2()).not.toMatch(/secret_python_code|secret-chart-spec|<script/);
  });

  it('keeps the published ordering and truncates long prose', async () => {
    for (const [slug, date] of [['old', '2024-01-01'], ['new', '2025-01-01']] as const) {
      const doc = manifest(slug);
      doc.metadata.date = date;
      doc.plainText = 'word '.repeat(150);
      fs.writeFileSync(path.join(root, 'content', 'blog', `${slug}.marimo.json`), JSON.stringify(doc));
    }
    vi.resetModules();
    const { generateFeed } = await import('../feed');
    const feed = await generateFeed();
    expect(feed.items.map(item => item.link)).toEqual(expect.arrayContaining([expect.stringMatching(/\/blog\/old$/), expect.stringMatching(/\/blog\/new$/)]));
    expect(feed.items[0].link).toMatch(/\/blog\/new$/);
    expect(feed.items[0].content).toContain('…');
    expect(feed.items[0].content?.length).toBeLessThan(550);
  });
});
