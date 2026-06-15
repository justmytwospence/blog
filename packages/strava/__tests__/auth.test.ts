import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAccessToken } from '../src/auth';

const originalFetch = globalThis.fetch;

describe('mintAccessToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports rotated=false when the refresh token is unchanged', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'same', expires_at: 123 }),
    }) as unknown as typeof fetch;
    const r = await mintAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'same' });
    expect(r.accessToken).toBe('a');
    expect(r.rotated).toBe(false);
  });

  it('reports rotated=true when Strava returns a new refresh token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'NEW', expires_at: 123 }),
    }) as unknown as typeof fetch;
    const r = await mintAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'old' });
    expect(r.refreshToken).toBe('NEW');
    expect(r.rotated).toBe(true);
  });

  it('throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'bad',
    }) as unknown as typeof fetch;
    await expect(
      mintAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'x' }),
    ).rejects.toThrow(/token refresh failed/);
  });
});
