import { describe, expect, it, vi } from 'vitest';
import { buildBranch, fromBuild, parseDomainArgs, previewHost, runPreviewDomain, type PreviewDomainDeps } from '../preview-domain';

const host = 'feature.dev.spencerboucher.com';
function setup(options: { branch?: string; absent?: boolean; verified?: boolean; project?: string; fail?: boolean; conflict?: boolean } = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET'; calls.push({ url, method, body: init?.body as string | undefined });
    if (options.fail) return new Response('{}', { status: 500 });
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('cloudflare')) throw new Error('unexpected Cloudflare call');
    if (url.includes('/v9/projects/') && !url.includes('/domains/')) return json({ id: options.project ?? 'prj_3tr1ZXKedofvZs88iTvd9OqHSn4J', accountId: 'team_TwgeP3rwrsOV5S5i2hX1oJIx' });
    if (method === 'GET' && options.absent && !(options.conflict && calls.filter((c) => c.method === 'GET' && c.url.includes('/domains/')).length > 1)) return json({}, 404);
    if (method === 'POST' && options.conflict) return json({}, 409);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return json({ gitBranch: options.branch ?? 'feature', verified: options.verified ?? true });
  });
  const deps: PreviewDomainDeps = { fetch: fetcher as typeof fetch, vercelToken: () => 'token' };
  return { deps, calls };
}
describe('preview domains', () => {
  it('validates exact host and CLI arguments', () => {
    expect(previewHost('feature')).toBe(host);
    for (const name of ['main', 'master', 'dev', 'www', 'HEAD', 'a/b', 'a--b', 'a'.repeat(64)]) expect(() => previewHost(name)).toThrow();
    for (const args of [[], ['feature', '--bad'], ['feature', '--remove', 'extra']]) expect(() => parseDomainArgs(args)).toThrow();
  });
  it('guards project, branch and API errors before mutation', async () => {
    for (const opt of [{ project: 'wrong' }, { branch: 'other' }, { fail: true }]) {
      for (const remove of [false, true]) {
        const c = setup(opt); await expect(runPreviewDomain('feature', remove, c.deps)).rejects.toThrow();
        expect(c.calls.every((x) => x.method === 'GET')).toBe(true);
      }
    }
  });
  it('reuses an existing matching domain and adds a missing one', async () => {
    const existing = setup(); await runPreviewDomain('feature', false, existing.deps); expect(existing.calls.every((x) => x.method === 'GET')).toBe(true);
    const added = setup({ absent: true }); await runPreviewDomain('feature', false, added.deps);
    const post = added.calls.find((x) => x.method === 'POST');
    expect(post?.url).toContain('/v10/projects/prj_3tr1ZXKedofvZs88iTvd9OqHSn4J/domains');
    expect(post?.body).toBe(JSON.stringify({ name: host, gitBranch: 'feature' }));
    expect(added.calls.every((x) => x.url.startsWith('https://api.vercel.com/'))).toBe(true);
  });
  it('requires the added domain to be verified', async () => {
    const c = setup({ absent: true, verified: false });
    await expect(runPreviewDomain('feature', false, c.deps)).rejects.toThrow('team should own spencerboucher.com');
  });
  it('removes the domain, and treats an absent one as done', async () => {
    const present = setup(); await runPreviewDomain('feature', true, present.deps);
    expect(present.calls.filter((x) => x.method === 'DELETE')).toHaveLength(1);
    const absent = setup({ absent: true }); await runPreviewDomain('feature', true, absent.deps);
    expect(absent.calls.some((x) => x.method === 'DELETE')).toBe(false);
  });
  it('refuses a conflicting domain outside this project', async () => {
    const c = setup({ absent: true, conflict: false });
    const original = c.deps.fetch;
    c.deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/v10/projects/') && init?.method === 'POST') return new Response('{}', { status: 409 });
      return original(input, init);
    }) as typeof fetch;
    await expect(runPreviewDomain('feature', false, c.deps)).rejects.toThrow('conflict outside this project');
  });
  it('accepts a 409 for a domain this project already holds for the branch', async () => {
    const c = setup({ absent: true, conflict: true });
    await runPreviewDomain('feature', false, c.deps);
    expect(c.calls.map((x) => x.method)).toEqual(['GET', 'GET', 'POST', 'GET']);
  });
});

describe('build hook', () => {
  const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature', PREVIEW_DOMAIN_TOKEN: 't' };
  it('picks the branch only for a Preview build with a token', () => {
    expect(buildBranch(preview)).toEqual({ branch: 'feature' });
    expect(buildBranch({ ...preview, VERCEL_ENV: 'production' })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, VERCEL_ENV: undefined })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, VERCEL_GIT_COMMIT_REF: undefined })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, PREVIEW_DOMAIN_TOKEN: undefined })).toEqual({ skip: 'PREVIEW_DOMAIN_TOKEN is not set' });
    for (const branch of ['main', 'master', 'dev', 'www']) expect(buildBranch({ ...preview, VERCEL_GIT_COMMIT_REF: branch })).toHaveProperty('skip');
  });
  it('logs the host, skips quietly and never throws', async () => {
    const log = vi.fn();
    const c = setup({ absent: true });
    await fromBuild(preview, c.deps, log);
    expect(log).toHaveBeenLastCalledWith(`preview domain: https://${host}`);
    await fromBuild({ ...preview, VERCEL_GIT_COMMIT_REF: 'dev' }, c.deps, log);
    expect(log).toHaveBeenLastCalledWith('preview domain: skipped (dev is reserved)');
    const failing = setup({ fail: true });
    await expect(fromBuild(preview, failing.deps, log)).resolves.toBeUndefined();
    expect(log).toHaveBeenLastCalledWith(expect.stringMatching(/^preview domain: not added: /));
  });
});
