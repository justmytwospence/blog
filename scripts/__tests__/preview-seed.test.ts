import { describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { PREVIEW_SNAPSHOT_KEYS, seedPreviewSnapshot, validateSeedConfig } from '../preview-seed';

const env = { PREVIEW_SOURCE_REDIS_REST_URL: 'https://source.test', PREVIEW_SOURCE_REDIS_REST_TOKEN: 'secret-source', BLOG_PREVIEW_REDIS_REST_URL: 'https://target.test', BLOG_PREVIEW_REDIS_REST_TOKEN: 'secret-target' };
function clients(values: Record<string, unknown> = { 'strava:totals': { total: 1 } }) {
  const events: string[] = [];
  const source = { get: vi.fn(async (key: string) => { events.push(`get:${key}`); return values[key] ?? null; }) };
  const target = { set: vi.fn(async (key: string) => { events.push(`set:${key}`); }), del: vi.fn(async (key: string) => { events.push(`del:${key}`); }) };
  return { source, target, events, run: () => seedPreviewSnapshot(source as unknown as Redis, target as unknown as Redis) };
}
describe('preview snapshot', () => {
  it('uses only the exact allowlist, reads before writes and deletes only missing base keys', async () => {
    expect(PREVIEW_SNAPSHOT_KEYS).toEqual(['strava:totals', 'strava:totals:updatedAt', 'last-good:strava:totals', 'last-good:github-history', 'last-good:github-activity', 'last-good:hardcover:recent-books', 'last-good:hardcover:reading-list:v2', 'last-good:inoreader:blogroll', 'last-good:inoreader:feeds']);
    const c = clients(); expect(await c.run()).toEqual({ copied: 1, missing: 8 });
    expect(c.events.slice(0, 9)).toEqual(PREVIEW_SNAPSHOT_KEYS.map((k) => `get:${k}`));
    expect(c.target.del.mock.calls.map(([k]) => k)).toEqual(PREVIEW_SNAPSHOT_KEYS.slice(1));
    expect(c.events.at(-1)).toBe('set:preview:snapshot:updatedAt');
  });
  it('never writes on missing totals or source failure', async () => {
    const c = clients({}); await expect(c.run()).rejects.toThrow(); expect(c.target.set).not.toHaveBeenCalled(); expect(c.target.del).not.toHaveBeenCalled();
    const d = clients(); d.source.get.mockRejectedValueOnce(new Error('secret')); await expect(d.run()).rejects.toThrow(); expect(d.target.set).not.toHaveBeenCalled(); expect(d.target.del).not.toHaveBeenCalled();
  });
  it('reports partial target failure without leaking values', async () => {
    const c = clients(); c.target.set.mockRejectedValueOnce(new Error('secret-target')); await expect(c.run()).rejects.toThrow('copy may be partial');
  });
  it('validates URLs, origin, confirmation and arguments', () => {
    expect(validateSeedConfig(['--confirm-target', 'target.test'], env).targetUrl).toBe(env.BLOG_PREVIEW_REDIS_REST_URL);
    for (const [args, changes] of [[['--confirm-target', 'target.test', '--force'], {}], [['--confirm-target', 'other'], {}], [['--confirm-target', 'target.test'], { PREVIEW_SOURCE_REDIS_REST_URL: 'https://TARGET.test:443/path' }], [['--confirm-target', 'target.test'], { PREVIEW_SOURCE_REDIS_REST_URL: 'http://source.test' }], [['--confirm-target', 'target.test'], { PREVIEW_SOURCE_REDIS_REST_URL: 'bad' }]] as const) {
      expect(() => validateSeedConfig([...args], { ...env, ...changes })).toThrow();
    }
  });
});
