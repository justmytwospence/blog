import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { construct } = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: class { constructor(env: unknown) { construct(env); } } }));

beforeEach(() => {
  vi.resetModules();
  construct.mockClear();
  for (const name of ['VERCEL_ENV', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'BLOG_PREVIEW_REDIS_REST_URL', 'BLOG_PREVIEW_REDIS_REST_TOKEN']) vi.stubEnv(name, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('Redis credentials', () => {
  it('uses only the preview pair and constructs lazily once', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'prod');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'prod-token');
    vi.stubEnv('BLOG_PREVIEW_REDIS_REST_URL', 'preview');
    vi.stubEnv('BLOG_PREVIEW_REDIS_REST_TOKEN', 'preview-token');
    const { getRedis, hasStore } = await import('../redis');
    expect(hasStore()).toBe(true);
    expect(construct).not.toHaveBeenCalled();
    expect(getRedis()).toBe(getRedis());
    expect(construct).toHaveBeenCalledExactlyOnceWith({ url: 'preview', token: 'preview-token' });
  });

  it.each([['', ''], ['preview', ''], ['', 'token']])('rejects incomplete preview pair', async (url, token) => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'prod');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'prod-token');
    vi.stubEnv('BLOG_PREVIEW_REDIS_REST_URL', url);
    vi.stubEnv('BLOG_PREVIEW_REDIS_REST_TOKEN', token);
    const { getRedis, hasStore } = await import('../redis');
    expect(hasStore()).toBe(false);
    expect(getRedis()).toBeNull();
    expect(construct).not.toHaveBeenCalled();
  });

  it.each(['production', 'development', ''])('retains Upstash precedence and KV fallback in %s', async env => {
    vi.stubEnv('VERCEL_ENV', env);
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'upstash');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'upstash-token');
    vi.stubEnv('KV_REST_API_URL', 'kv');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    let redis = await import('../redis');
    redis.getRedis();
    expect(construct).toHaveBeenLastCalledWith({ url: 'upstash', token: 'upstash-token' });
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', undefined);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', undefined);
    redis = await import('../redis');
    redis.getRedis();
    expect(construct).toHaveBeenLastCalledWith({ url: 'kv', token: 'kv-token' });
  });
});
