import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEAM = 'team_TwgeP3rwrsOV5S5i2hX1oJIx';
const PROJECT = 'prj_3tr1ZXKedofvZs88iTvd9OqHSn4J';
const ZONE = 'spencerboucher.com';
const VERIFY = `_vercel.${ZONE}`;

export interface PreviewDomainDeps {
  fetch: typeof globalThis.fetch;
  vercelToken: () => string;
  cloudflareToken: string;
  sleep: (ms: number) => Promise<void>;
}
export function previewHost(branch: string): string {
  if (branch.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch) || ['main', 'master', 'dev', 'www'].includes(branch)) throw new Error('Invalid or reserved preview branch');
  return `${branch}.dev.${ZONE}`;
}

type Domain = { gitBranch?: string | null; verified?: boolean; verification?: { type: string; domain: string; value: string }[] };
type RecordItem = { id: string; content: string };
type VercelResponse = Domain & { id?: string; accountId?: string };
type Zone = { id: string; name: string };
export async function runPreviewDomain(branch: string, remove: boolean, deps: PreviewDomainDeps): Promise<void> {
  const host = previewHost(branch);
  if (!deps.cloudflareToken) throw new Error('CLOUDFLARE_API_TOKEN required');
  const token = deps.vercelToken();
  if (!token) throw new Error('Vercel token required');
  async function vercel(method: string, path: string, body?: unknown, allow404 = false, allow409 = false, allowPendingVerification = false): Promise<{ status: number; data: VercelResponse }> {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', TEAM);
    const res = await deps.fetch(url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok && !(allow404 && res.status === 404) && !(allow409 && res.status === 409) && !(allowPendingVerification && res.status === 400)) throw new Error(`Vercel ${method} failed (HTTP ${res.status})`);
    if (res.status === 400 || res.status === 404 || res.status === 409 || res.status === 204) return { status: res.status, data: {} };
    return { status: res.status, data: await res.json() };
  }
  async function cloudflare<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await deps.fetch(`https://api.cloudflare.com/client/v4${path}`, { method, headers: { authorization: `Bearer ${deps.cloudflareToken}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new Error(`Cloudflare ${method} failed (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error(`Cloudflare ${method} API failed`);
    if (data.result_info && data.result_info.total_pages > 1) throw new Error('Cloudflare results are paginated; refusing incomplete lookup');
    return data.result;
  }
  const project = (await vercel('GET', `/v9/projects/${PROJECT}`)).data;
  if (project.id !== PROJECT || project.accountId !== TEAM) throw new Error('Vercel project or team mismatch');
  const zones = await cloudflare<Zone[]>('GET', `/zones?name=${ZONE}&per_page=100`);
  if (!Array.isArray(zones) || zones.length !== 1 || zones[0].name !== ZONE || !zones[0].id) throw new Error('Expected exactly one matching Cloudflare zone');
  const zoneId = encodeURIComponent(zones[0].id);
  const domainPath = `/v9/projects/${PROJECT}/domains/${host}`;
  const getDomain = () => vercel('GET', domainPath, undefined, true);
  const existing = await getDomain();
  function checkBinding(domain: Domain) {
    if (domain.gitBranch !== branch) throw new Error(`Domain ${host} has a different branch binding`);
  }
  if (existing.status !== 404) checkBinding(existing.data);
  const records = async (): Promise<RecordItem[]> => {
    const result = await cloudflare<RecordItem[]>('GET', `/zones/${zoneId}/dns_records?type=TXT&name=${VERIFY}&per_page=100`);
    if (!Array.isArray(result)) throw new Error('Invalid Cloudflare DNS response');
    return result.filter((r: RecordItem) => typeof r.content === 'string' && r.content.replace(/"/g, '').startsWith(`vc-domain-verify=${host},`));
  };
  if (remove) {
    if (existing.status !== 404) await vercel('DELETE', domainPath, undefined, true);
    for (const record of await records()) await cloudflare('DELETE', `/zones/${zoneId}/dns_records/${encodeURIComponent(record.id)}`);
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
  if (domain.verified) return;
  const current = new Set((await records()).map((r) => r.content.replace(/"/g, '')));
  for (const v of domain.verification ?? []) {
    if (v.type !== 'TXT' || v.domain !== VERIFY || !v.value.startsWith(`vc-domain-verify=${host},`)) throw new Error('Unexpected domain verification request');
    if (!current.has(v.value)) {
      await cloudflare('POST', `/zones/${zoneId}/dns_records`, { type: 'TXT', name: VERIFY, content: JSON.stringify(v.value), ttl: 1 });
      current.add(v.value);
    }
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    // Vercel returns 400 while the DNS challenge is not visible yet; allow propagation time.
    const verified = await vercel('POST', `${domainPath}/verify`, undefined, false, false, true);
    if (verified.status !== 400) {
      // gitBranch is optional in the verify response; confirm ownership from the domain lookup.
      const current = await getDomain();
      if (current.status === 404) throw new Error('Domain disappeared during verification');
      checkBinding(current.data);
      if (verified.data.verified) return;
    }
    if (attempt < 9) await deps.sleep(3000);
  }
  throw new Error(`${host} added but verification is incomplete; rerun safely`);
}

function vercelToken(): string {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  for (const dir of [join(homedir(), 'Library/Application Support/com.vercel.cli'), join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'com.vercel.cli')]) {
    try { const token = JSON.parse(readFileSync(join(dir, 'auth.json'), 'utf8')).token; if (token) return token; } catch { /* try next login */ }
  }
  throw new Error('Set VERCEL_TOKEN or log in with vercel login');
}
export function parseDomainArgs(args: string[]): { branch: string; remove: boolean } {
  if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--remove')) throw new Error('Usage: preview:domain <branch> [--remove]');
  previewHost(args[0]);
  return { branch: args[0], remove: args.length === 2 };
}
async function main() {
  const { branch, remove } = parseDomainArgs(process.argv.slice(2));
  await runPreviewDomain(branch, remove, { fetch: globalThis.fetch, vercelToken, cloudflareToken: process.env.CLOUDFLARE_API_TOKEN ?? '', sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) });
  console.log(remove ? `Removed ${previewHost(branch)}` : `https://${previewHost(branch)} serves ${branch}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Preview domain failed'); process.exitCode = 1; });
}
