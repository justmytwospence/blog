import { Redis } from '@upstash/redis';
import { pathToFileURL } from 'node:url';

export const PREVIEW_SNAPSHOT_KEYS = [
  'strava:totals', 'strava:totals:updatedAt', 'last-good:strava:totals',
  'last-good:github-history', 'last-good:github-activity', 'last-good:hardcover:recent-books',
  'last-good:hardcover:reading-list:v2', 'last-good:inoreader:blogroll', 'last-good:inoreader:feeds',
] as const;

class PreviewSeedError extends Error {}

export async function seedPreviewSnapshot(source: Redis, target: Redis): Promise<{ copied: number; missing: number }> {
  let values: unknown[];
  try {
    values = await Promise.all(PREVIEW_SNAPSHOT_KEYS.map((key) => source.get(key)));
  } catch {
    throw new PreviewSeedError('Source read failed; target was not changed. Check source credentials and connectivity.');
  }
  if (values[0] == null) throw new PreviewSeedError('Source is missing strava:totals; target was not changed.');
  let copied = 0;
  try {
    for (const [i, key] of PREVIEW_SNAPSHOT_KEYS.entries()) {
      if (values[i] == null) await target.del(key);
      else { await target.set(key, values[i]); copied++; }
    }
    await target.set('preview:snapshot:updatedAt', new Date().toISOString());
  } catch {
    throw new PreviewSeedError('Target write failed; copy may be partial. Check target access, then rerun with the same confirmed target.');
  }
  return { copied, missing: PREVIEW_SNAPSHOT_KEYS.length - copied };
}

export function validateSeedConfig(args: string[], env: Record<string, string | undefined>) {
  if (args.length !== 2 || args[0] !== '--confirm-target' || !args[1]) throw new PreviewSeedError('Usage: preview:seed --confirm-target <target-hostname>');
  const sourceUrl = env.PREVIEW_SOURCE_REDIS_REST_URL;
  const sourceToken = env.PREVIEW_SOURCE_REDIS_REST_TOKEN;
  const targetUrl = env.BLOG_PREVIEW_REDIS_REST_URL;
  const targetToken = env.BLOG_PREVIEW_REDIS_REST_TOKEN;
  if (!sourceUrl || !sourceToken || !targetUrl || !targetToken) throw new PreviewSeedError('Explicit source and preview Redis credentials required');
  let source: URL, target: URL;
  try { source = new URL(sourceUrl); target = new URL(targetUrl); } catch { throw new PreviewSeedError('Invalid Redis URL'); }
  if (source.protocol !== 'https:' || target.protocol !== 'https:' || source.username || source.password || target.username || target.password) throw new PreviewSeedError('Redis URLs must use HTTPS without embedded credentials');
  if (source.origin === target.origin) throw new PreviewSeedError('Source and target origins must differ');
  if (args[1] !== target.hostname) throw new PreviewSeedError('Target hostname confirmation does not match');
  return { sourceUrl, sourceToken, targetUrl, targetToken };
}

async function main() {
  const c = validateSeedConfig(process.argv.slice(2), process.env);
  const result = await seedPreviewSnapshot(new Redis({ url: c.sourceUrl, token: c.sourceToken }), new Redis({ url: c.targetUrl, token: c.targetToken }));
  console.log(`Copied ${result.copied}, missing ${result.missing}; completed ${new Date().toISOString()}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof PreviewSeedError ? error.message : 'Preview seed failed. Check configuration; target copy may be partial.');
    process.exitCode = 1;
  });
}
