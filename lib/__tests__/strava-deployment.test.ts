import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaTotals } from '@blog/strava';

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(), get: vi.fn(), set: vi.fn(), mint: vi.fn(), crawl: vi.fn(), build: vi.fn(), revalidate: vi.fn(), after: vi.fn(),
}));
vi.mock('../redis', () => ({ getRedis: mocks.getRedis, hasStore: () => true }));
vi.mock('@blog/strava', () => ({ mintAccessToken: mocks.mint, crawlActivities: mocks.crawl, buildTotals: mocks.build }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/server', () => ({ after: mocks.after }));
import { getAccessToken, recomputeTotals, writeTotals } from '../strava-store';
import * as webhook from '../../app/api/strava/webhook/route';
import * as reconcile from '../../app/api/strava/reconcile/route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRAVA_CLIENT_ID', 'id');
  vi.stubEnv('STRAVA_CLIENT_SECRET', 'secret');
  vi.stubEnv('STRAVA_REFRESH_TOKEN', 'refresh');
  vi.stubEnv('STRAVA_VERIFY_TOKEN', 'verify');
  vi.stubEnv('STRAVA_SUBSCRIPTION_ID', '42');
  vi.stubEnv('CRON_SECRET', 'cron');
  mocks.getRedis.mockReturnValue({ get: mocks.get, set: mocks.set });
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue('OK');
  mocks.mint.mockResolvedValue({ accessToken: 'access', refreshToken: 'rotated', expiresAt: 123 });
  mocks.crawl.mockResolvedValue(['activity']);
  mocks.build.mockReturnValue({ total: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe('Strava deployment isolation', () => {
  it.each(['preview', 'development', '', 'unknown'])('rejects mutations and routes in %s', async env => {
    vi.stubEnv('VERCEL_ENV', env);
    vi.stubEnv('NODE_ENV', 'production');
    await expect(writeTotals({} as StravaTotals)).rejects.toThrow('Production deployment required');
    await expect(getAccessToken()).rejects.toThrow('Production deployment required');
    await expect(recomputeTotals()).rejects.toThrow('Production deployment required');
    const request = { get url() { throw new Error('url accessed'); }, get headers() { throw new Error('headers accessed'); }, json: vi.fn(() => { throw new Error('body accessed'); }) } as unknown as Request;
    expect(webhook.GET(request).status).toBe(404);
    expect((await webhook.POST(request)).status).toBe(404);
    expect((await reconcile.GET(request)).status).toBe(404);
    expect(request.json).not.toHaveBeenCalled();
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });

  it('keeps production handshake and webhook scheduling', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const handshake = webhook.GET(new Request('https://example.com/?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=abc'));
    expect(await handshake.json()).toEqual({ 'hub.challenge': 'abc' });
    expect(webhook.GET(new Request('https://example.com/')).status).toBe(403);
    const post = (body: unknown) => webhook.POST(new Request('https://example.com/', { method: 'POST', body: JSON.stringify(body) }));
    expect((await post({ object_type: 'activity', aspect_type: 'create', subscription_id: 41 })).status).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
    expect((await post({ object_type: 'activity', aspect_type: 'update', subscription_id: 42 })).status).toBe(200);
    expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.crawl).toHaveBeenCalledWith('access');
    expect(mocks.revalidate).toHaveBeenCalledWith('/adventures');
  });

  it('authenticates reconcile and recomputes production totals', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await reconcile.GET(new Request('https://example.com/'))).status).toBe(401);
    expect(mocks.mint).not.toHaveBeenCalled();
    const response = await reconcile.GET(new Request('https://example.com/', { headers: { authorization: 'Bearer cron' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.mint).toHaveBeenCalledWith({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' });
    expect(mocks.set).toHaveBeenCalledWith('strava:totals', { total: 1 });
    expect(mocks.set).toHaveBeenCalledWith('strava:totals:updatedAt', expect.any(String));
    expect(mocks.revalidate).toHaveBeenCalledWith('/adventures');
  });
});
