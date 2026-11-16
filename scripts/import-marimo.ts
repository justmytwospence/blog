// Import an already executed official marimo HTML export. Never start Python or run notebook cells.
// Usage: tsx scripts/import-marimo.ts --slug kcore --html /path/to/export.html
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublicationConfig } from 'marimo-blog/node';
import { compileSnapshot, hashPublicationConfig, importMarimoHtml, parseMetadataYaml, verifyBuild, writeBuild } from 'marimo-blog/node';
import { assertSafePath, blogRoot, expectedAssetBase, linkedFileDigests, publicationPaths } from './validate-marimo';

type Section = 'blog' | 'projects';
interface Args { slug: string; html: string; section: Section; publicDir?: string }
function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--slug', '--html', '--section', '--public-dir'].includes(argv[i] ?? '') || !argv[i + 1] || argv[i + 1]!.startsWith('--') || flags.has(argv[i]!)) {
      throw new Error('Usage: notebook:import -- --slug <slug> --html <export.html> [--section blog|projects] [--public-dir <source-public-dir>]');
    }
    flags.set(argv[i]!, argv[i + 1]!);
  }
  const slug = flags.get('--slug');
  const html = flags.get('--html');
  const section = flags.get('--section') ?? 'blog';
  if (!slug || !html || (section !== 'blog' && section !== 'projects')) throw new Error('Require --slug, --html and optionally --section blog|projects');
  return { slug, html, section, ...(flags.has('--public-dir') ? { publicDir: flags.get('--public-dir') } : {}) };
}

export async function bundlePosters(config: PublicationConfig, yamlPath: string, digests: Record<string, string>): Promise<PublicationConfig> {
  const resolved = structuredClone(config);
  for (const cell of Object.values(resolved.cells ?? {})) for (const output of Object.values(cell.outputs ?? {})) {
    const poster = output.poster;
    if (!poster || /^https:\/\//.test(poster)) continue;
    const file = resolve(dirname(yamlPath), poster);
    await assertSafePath(dirname(yamlPath), file);
    const bytes = await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== digests[poster]) throw new Error(`Poster changed during import: ${poster}`);
    const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' } as Record<string, string>)[extname(poster).toLowerCase()];
    if (!mime) throw new Error(`Unsupported poster image: ${poster}`);
    output.poster = `data:${mime};base64,${bytes.toString('base64')}`;
  }
  return resolved;
}

export async function importMarimo(args: Args): Promise<void> {
  const paths = publicationPaths(args.section, args.slug);
  await assertSafePath(blogRoot, paths.contentDir);
  await assertSafePath(blogRoot, paths.publicDir);
  await assertSafePath(paths.contentDir, paths.yaml);
  await assertSafePath(paths.contentDir, paths.document);
  await assertSafePath(paths.publicDir, paths.assetsDir);
  const config = parseMetadataYaml(await readFile(paths.yaml, 'utf8'));
  if (config.slug !== args.slug) throw new Error(`YAML slug ${config.slug} does not match ${args.slug}`);
  const linked = await linkedFileDigests(config, paths.yaml);
  const htmlPath = resolve(args.html);
  const info = await stat(htmlPath);
  if (!info.isFile() || !htmlPath.endsWith('.html')) throw new Error('--html must point to an existing regular .html export');
  const snapshot = importMarimoHtml(await readFile(htmlPath, 'utf8'));
  const result = await compileSnapshot(snapshot, {
    metadata: await bundlePosters(config, paths.yaml, linked),
    assetBase: paths.assetBase,
    ...(args.publicDir ? { publicDir: resolve(args.publicDir) } : {}),
  });
  // Include the author-linked file contents in the published config provenance.
  result.document.provenance.publicationConfigSha256 = hashPublicationConfig(config, linked);
  await writeBuild(result, { documentPath: paths.document, assetsDir: paths.assetsDir, ownerId: paths.ownerId });
  for (const item of result.document.diagnostics) console.warn(`${item.severity} ${item.code}${item.cellId ? ` (cell ${item.cellId})` : ''}: ${item.message}`);
  const assetBase = await expectedAssetBase(paths.publicDir, paths.assetsDir);
  if (assetBase !== paths.assetBase) throw new Error(`Asset directory does not match slug: ${assetBase}`);
  const diagnostics = await verifyBuild(result.document, { assetsDir: paths.assetsDir, expectedAssetBase: assetBase, ownerId: paths.ownerId });
  for (const item of diagnostics) console.error(`${item.severity} ${item.code}: ${item.message}`);
  if (diagnostics.some((item) => item.severity === 'error')) throw new Error('Imported publication failed asset verification');
  const bytes = result.document.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  console.log(`[notebook:import] ${args.slug}: ${result.document.cells.length} cells, ${result.document.assets.length} assets (${bytes} bytes) -> ${paths.document}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importMarimo(parseArgs(process.argv.slice(2))).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
