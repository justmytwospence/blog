import { describe, expect, it, vi } from 'vitest';
import { parseDomainArgs, previewHost, runPreviewDomain, type PreviewDomainDeps } from '../preview-domain';

const host = 'feature.dev.spencerboucher.com';
function setup(options: { branch?: string; absent?: boolean; verified?: boolean; project?: string; zones?: number; fail?: boolean } = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET'; calls.push({ url, method, body: init?.body as string | undefined });
    if (options.fail) return new Response('{}', { status: 500 });
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('api.cloudflare.com')) {
      if (url.includes('/zones?')) return json({ success: true, result: Array.from({ length: options.zones ?? 1 }, () => ({ id: 'zone', name: 'spencerboucher.com' })) });
      if (method === 'GET') return json({ success: true, result: [{ id: 'ours', content: `vc-domain-verify=${host},abc` }, { id: 'other', content: 'vc-domain-verify=other.dev.spencerboucher.com,abc' }] });
      return json({ success: true, result: {} });
    }
    if (url.includes('/v9/projects/') && !url.includes('/domains/')) return json({ id: options.project ?? 'prj_3tr1ZXKedofvZs88iTvd9OqHSn4J', accountId: 'team_TwgeP3rwrsOV5S5i2hX1oJIx' });
    if (url.includes('/verify')) return json({ gitBranch: options.branch ?? 'feature', verified: options.verified ?? true });
    if (method === 'GET' && options.absent) return json({}, 404);
    return json({ gitBranch: options.branch ?? 'feature', verified: options.verified ?? true, verification: [{ type: 'TXT', domain: '_vercel.spencerboucher.com', value: `vc-domain-verify=${host},abc` }] });
  });
  const deps: PreviewDomainDeps = { fetch: fetcher as typeof fetch, vercelToken: () => 'token', cloudflareToken: 'token', sleep: vi.fn(async () => {}) };
  return { deps, calls };
}
describe('preview domains', () => {
  it('validates exact host and CLI arguments', () => {
    expect(previewHost('feature')).toBe(host);
    for (const name of ['main', 'master', 'dev', 'www', 'HEAD', 'a/b', 'a--b', 'a'.repeat(64)]) expect(() => previewHost(name)).toThrow();
    for (const args of [[], ['feature', '--bad'], ['feature', '--remove', 'extra']]) expect(() => parseDomainArgs(args)).toThrow();
  });
  it('guards project, zone, branch and API errors before mutation', async () => {
    for (const opt of [{ project: 'wrong' }, { zones: 2 }, { branch: 'other' }, { fail: true }]) {
      for (const remove of [false, true]) {
        const c = setup(opt); await expect(runPreviewDomain('feature', remove, c.deps)).rejects.toThrow();
        expect(c.calls.every((x) => x.method === 'GET')).toBe(true);
      }
    }
  });
  it('reuses an existing matching domain and adds a missing one', async () => {
    const existing = setup(); await runPreviewDomain('feature', false, existing.deps); expect(existing.calls.every((x) => x.method === 'GET')).toBe(true);
    const added = setup({ absent: true }); await runPreviewDomain('feature', false, added.deps); expect(added.calls.find((x) => x.method === 'POST')?.body).toContain('"gitBranch":"feature"');
  });
  it('removes only owned TXT records, including for absent domains', async () => {
    for (const absent of [false, true]) {
      const c = setup({ absent }); await runPreviewDomain('feature', true, c.deps);
      const deletes = c.calls.filter((x) => x.method === 'DELETE');
      expect(deletes.some((x) => x.url.endsWith('/dns_records/ours'))).toBe(true);
      expect(deletes.some((x) => x.url.endsWith('/dns_records/other'))).toBe(false);
    }
  });
  it('creates only the hostname-specific requested TXT and verifies', async () => {
    const c = setup({ verified: false });
    const original = c.deps.fetch;
    c.deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/dns_records?')) {
        c.calls.push({ url: String(input), method: 'GET' });
        return new Response(JSON.stringify({ success: true, result: [] }));
      }
      if (String(input).includes('/verify')) {
        c.calls.push({ url: String(input), method: 'POST' });
        return new Response(JSON.stringify({ gitBranch: 'feature', verified: true }));
      }
      return original(input, init);
    }) as typeof fetch;
    await runPreviewDomain('feature', false, c.deps);
    const created = c.calls.find((x) => x.url.includes('/dns_records') && x.method === 'POST');
    expect(created?.body).toContain(`vc-domain-verify=${host},abc`);
  });
  it('waits through DNS propagation and accepts verify responses without optional gitBranch', async () => {
    const c = setup({ verified: false });
    const original = c.deps.fetch;
    let attempts = 0;
    c.deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/verify')) {
        attempts++;
        return attempts === 1
          ? new Response('{}', { status: 400 })
          : new Response(JSON.stringify({ verified: true }));
      }
      return original(input, init);
    }) as typeof fetch;
    await runPreviewDomain('feature', false, c.deps);
    expect(attempts).toBe(2);
    expect(c.deps.sleep).toHaveBeenCalledOnce();
  });
  it('refuses a conflicting domain outside this project', async () => {
    const c = setup({ absent: true });
    const original = c.deps.fetch;
    c.deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/v10/projects/') && init?.method === 'POST') return new Response('{}', { status: 409 });
      return original(input, init);
    }) as typeof fetch;
    await expect(runPreviewDomain('feature', false, c.deps)).rejects.toThrow('conflict outside this project');
    expect(c.calls.filter((call) => call.url.includes('api.cloudflare.com')).every((call) => call.method === 'GET')).toBe(true);
  });
  it('times out safely and reuses existing TXT', async () => {
    const c = setup({ verified: false }); await expect(runPreviewDomain('feature', false, c.deps)).rejects.toThrow('verification is incomplete');
    expect(c.calls.filter((x) => x.url.includes('/dns_records') && x.method === 'POST')).toHaveLength(0);
    expect(c.calls.filter((x) => x.url.includes('/verify'))).toHaveLength(10);
  });
});
