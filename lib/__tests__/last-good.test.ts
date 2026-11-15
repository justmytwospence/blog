import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getRedis, get, set } = vi.hoisted(() => ({ getRedis: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock('../redis', () => ({ getRedis }));
import { readThrough } from '../last-good';

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'branch/a');
  get.mockReset(); set.mockReset(); getRedis.mockReset().mockReturnValue({ get, set });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const fail = async (): Promise<string> => { throw new Error('offline'); };

describe('last-good', () => {
  it('writes and reads the base key in production', async () => {
    expect(await readThrough('foo', async () => 'fresh')).toBe('fresh');
    expect(set).toHaveBeenCalledWith('last-good:foo', 'fresh');
    get.mockResolvedValue('old');
    expect(await readThrough('foo', fail)).toBe('old');
    expect(get).toHaveBeenCalledWith('last-good:foo');
  });
  it('passes through without a store, including failures', async () => {
    getRedis.mockReturnValue(null);
    expect(await readThrough('foo', async () => 'fresh')).toBe('fresh');
    await expect(readThrough('foo', fail)).rejects.toThrow('offline');
  });
  it('isolates preview branch writes with capped TTL', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    await readThrough('foo', async () => 'fresh');
    expect(set).toHaveBeenLastCalledWith('preview:branch%2Fa:last-good:foo', 'fresh', { ex: 604800 });
    await readThrough('foo', async () => 'fresh', { ttlSeconds: 30 });
    expect(set).toHaveBeenLastCalledWith('preview:branch%2Fa:last-good:foo', 'fresh', { ex: 30 });
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'branch-b');
    await readThrough('foo', async () => 'fresh', { ttlSeconds: 999999 });
    expect(set).toHaveBeenLastCalledWith('preview:branch-b:last-good:foo', 'fresh', { ex: 604800 });
    expect(set.mock.calls.every(([key]) => key !== 'last-good:foo')).toBe(true);
  });
  it('reads branch first, then base on missing or branch error', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    get.mockResolvedValueOnce('branch');
    expect(await readThrough('foo', fail)).toBe('branch');
    expect(get).toHaveBeenCalledTimes(1);
    get.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce('base');
    expect(await readThrough('foo', fail)).toBe('base');
    expect(get.mock.calls.map(([key]) => key)).toEqual(['preview:branch%2Fa:last-good:foo', 'last-good:foo']);
    get.mockReset().mockRejectedValueOnce(new Error('read')).mockResolvedValueOnce('base');
    expect(await readThrough('foo', fail)).toBe('base');
  });
  it('returns null for missing or failed reads and fresh on write failure', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    get.mockResolvedValue(null);
    expect(await readThrough('foo', fail)).toBeNull();
    get.mockRejectedValue(new Error('read'));
    expect(await readThrough('foo', fail)).toBeNull();
    set.mockRejectedValue(new Error('write'));
    expect(await readThrough('foo', async () => 'fresh')).toBe('fresh');
  });
});
