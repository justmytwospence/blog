import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionDeployment, isPreviewDeployment, isProductionDeployment, previewCachePrefix } from '../deployment';

afterEach(() => vi.unstubAllEnvs());

describe('deployment identity', () => {
  it.each(['production', 'preview', 'development', '', 'other'])('classifies %s', env => {
    vi.stubEnv('VERCEL_ENV', env);
    expect(isProductionDeployment()).toBe(env === 'production');
    expect(isPreviewDeployment()).toBe(env === 'preview');
    if (env === 'production') expect(() => assertProductionDeployment()).not.toThrow();
    else expect(() => assertProductionDeployment()).toThrow('Production deployment required');
  });

  it('does not authorize NODE_ENV alone', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertProductionDeployment()).toThrow();
  });

  it('encodes distinct refs and falls back safely', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'a/b');
    expect(previewCachePrefix()).toBe('preview:a%2Fb:');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'a-b');
    expect(previewCachePrefix()).toBe('preview:a-b:');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', '');
    vi.stubEnv('VERCEL_URL', 'test.example');
    expect(previewCachePrefix()).toBe('preview:test.example:');
    vi.stubEnv('VERCEL_URL', '');
    expect(previewCachePrefix()).toBe('preview:unknown:');
  });
});
