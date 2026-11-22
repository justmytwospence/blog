import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEAM = 'team_TwgeP3rwrsOV5S5i2hX1oJIx';
const PROJECT = 'prj_3tr1ZXKedofvZs88iTvd9OqHSn4J';
const ZONE = 'spencerboucher.com';
const RESERVED = ['main', 'master', 'dev', 'www'];

export interface PreviewDomainDeps {
  fetch: typeof globalThis.fetch;
  vercelToken: () => string;
}
export function previewHost(branch: string): string {
  if (branch.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch) || RESERVED.includes(branch)) throw new Error('Invalid or reserved preview branch');
  return `${branch}.dev.${ZONE}`;
}

type Domain = { gitBranch?: string | null; verified?: boolean; verification?: unknown };
type VercelResponse = Domain & { id?: string; accountId?: string };
// The team owns the apex on Vercel, so a subdomain verifies as soon as it is added: no TXT record, no DNS API.
export async function runPreviewDomain(branch: string, remove: boolean, deps: PreviewDomainDeps): Promise<void> {
  const host = previewHost(branch);
  const token = deps.vercelToken();
  if (!token) throw new Error('Vercel token required');
  async function vercel(method: string, path: string, body?: unknown, allow404 = false, allow409 = false): Promise<{ status: number; data: VercelResponse }> {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', TEAM);
    const res = await deps.fetch(url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok && !(allow404 && res.status === 404) && !(allow409 && res.status === 409)) throw new Error(`Vercel ${method} failed (HTTP ${res.status})`);
    if (res.status === 404 || res.status === 409 || res.status === 204) return { status: res.status, data: {} };
    return { status: res.status, data: await res.json() };
  }
  const project = (await vercel('GET', `/v9/projects/${PROJECT}`)).data;
  if (project.id !== PROJECT || project.accountId !== TEAM) throw new Error('Vercel project or team mismatch');
  const domainPath = `/v9/projects/${PROJECT}/domains/${host}`;
  const getDomain = () => vercel('GET', domainPath, undefined, true);
  const existing = await getDomain();
  function checkBinding(domain: Domain) {
    if (domain.gitBranch !== branch) throw new Error(`Domain ${host} has a different branch binding`);
  }
  if (existing.status !== 404) checkBinding(existing.data);
  if (remove) {
    if (existing.status !== 404) await vercel('DELETE', domainPath, undefined, true);
    return;
  }
  let domain: Domain = existing.data;
  if (existing.status === 404) {
    const added = await vercel('POST', `/v10/projects/${PROJECT}/domains`, { name: host, gitBranch: branch }, false, true);
    if (added.status === 409) {
      const found = await getDomain();
      if (found.status === 404) throw new Error('Domain conflict outside this project');
      domain = found.data;
    } else domain = added.data;
    checkBinding(domain);
  }
  if (!domain.verified) throw new Error(`${host} is not verified; the team should own ${ZONE} on Vercel`);
}

/** The Vercel build's branch, or why it gets no preview hostname. */
export function buildBranch(env: Record<string, string | undefined>): { branch: string } | { skip: string } {
  if (env.VERCEL_ENV !== 'preview') return { skip: `a ${env.VERCEL_ENV ?? 'local'} build` };
  const branch = env.VERCEL_GIT_COMMIT_REF;
  if (!branch) return { skip: 'no Git branch' };
  if (RESERVED.includes(branch)) return { skip: `${branch} is reserved` };
  if (!env.PREVIEW_DOMAIN_TOKEN) return { skip: 'PREVIEW_DOMAIN_TOKEN is not set' };
  return { branch };
}

/** From the Vercel build: never fails it, a missing hostname is not worth a failed preview. */
export async function fromBuild(env: Record<string, string | undefined>, deps: PreviewDomainDeps, log: (line: string) => void = console.log): Promise<void> {
  const target = buildBranch(env);
  if ('skip' in target) return log(`preview domain: skipped (${target.skip})`);
  try {
    await runPreviewDomain(target.branch, false, deps);
    log(`preview domain: https://${previewHost(target.branch)}`);
  } catch (error) {
    log(`preview domain: not added: ${error instanceof Error ? error.message : error}`);
  }
}

function vercelToken(): string {
  const env = process.env.PREVIEW_DOMAIN_TOKEN || process.env.VERCEL_TOKEN;
  if (env) return env;
  for (const dir of [join(homedir(), 'Library/Application Support/com.vercel.cli'), join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'com.vercel.cli')]) {
    try { const token = JSON.parse(readFileSync(join(dir, 'auth.json'), 'utf8')).token; if (token) return token; } catch { /* try next login */ }
  }
  throw new Error('Set PREVIEW_DOMAIN_TOKEN or VERCEL_TOKEN, or log in with vercel login');
}
export function parseDomainArgs(args: string[]): { branch: string; remove: boolean } {
  if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--remove')) throw new Error('Usage: preview:domain <branch> [--remove] | --build');
  previewHost(args[0]);
  return { branch: args[0], remove: args.length === 2 };
}
async function main() {
  const args = process.argv.slice(2);
  const deps: PreviewDomainDeps = { fetch: globalThis.fetch, vercelToken };
  if (args.includes('--build')) return fromBuild(process.env, deps);
  const { branch, remove } = parseDomainArgs(args);
  await runPreviewDomain(branch, remove, deps);
  console.log(remove ? `Removed ${previewHost(branch)}` : `https://${previewHost(branch)} serves ${branch}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Preview domain failed'); process.exitCode = 1; });
}
