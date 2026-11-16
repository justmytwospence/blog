import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { PublicationConfig } from 'marimo-blog/node';
import { bundlePosters } from '../import-marimo';
import { linkedFileDigests } from '../validate-marimo';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const config: PublicationConfig = { slug: 'sample', title: 'Sample', date: '2026-01-01', description: 'Sample', cells: { chart: { outputs: { '0': { poster: 'poster.png' } } } } };

describe('reviewed local chart posters', () => {
  it('bundles the same bytes covered by the original YAML provenance without mutating metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'blog-poster-')); roots.push(root);
    const yaml = join(root, 'sample.marimo.yaml');
    await writeFile(join(root, 'poster.png'), 'synthetic image bytes');
    const digests = await linkedFileDigests(config, yaml);
    const resolved = await bundlePosters(config, yaml, digests);
    expect(resolved.cells?.chart?.outputs?.['0']?.poster).toBe(`data:image/png;base64,${Buffer.from('synthetic image bytes').toString('base64')}`);
    expect(config.cells?.chart?.outputs?.['0']?.poster).toBe('poster.png');
    await writeFile(join(root, 'poster.png'), 'changed bytes');
    await expect(bundlePosters(config, yaml, digests)).rejects.toThrow(/changed during import/);
  });
});
