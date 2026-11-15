import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('deployment headers', () => {
  it.each(['production', 'preview', 'development', ''])('sets security headers for %s', async env => {
    vi.stubEnv('VERCEL_ENV', env);
    vi.resetModules();
    const { default: config } = await import('../../next.config.mjs');
    const rules = await config.headers();
    expect(rules[0].source).toBe('/:path*');
    expect(rules[0].headers).toEqual(expect.arrayContaining([
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    ]));
    const headers = rules[0].headers as { key: string; value: string }[];
    expect(headers.some(h => h.key === 'X-Robots-Tag' && h.value === 'noindex, nofollow')).toBe(env !== 'production');
  });
});
