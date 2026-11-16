// Validate offline marimo publications. No notebook code or export is executed.
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPublicationConfig, parseMetadataYaml, readDocument, verifyBuild } from 'marimo-blog/node';
import type { PublicationConfig } from 'marimo-blog/node';

export const blogRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sections = ['blog', 'projects'] as const;
type Section = (typeof sections)[number];

export function publicationPaths(section: Section, slug: string) {
  if (!slugPattern.test(slug)) throw new Error(`Invalid marimo slug: ${slug}`);
  const contentDir = join(blogRoot, 'content', section);
  const publicDir = join(blogRoot, 'public');
  const assetsDir = join(publicDir, 'notebooks', slug, 'assets');
  return {
    contentDir, publicDir, assetsDir,
    yaml: join(contentDir, `${slug}.marimo.yaml`),
    document: join(contentDir, `${slug}.marimo.json`),
    assetBase: `/notebooks/${slug}/assets`,
    ownerId: `content/${section}/${slug}.marimo.json`,
  };
}

// Check each path component (including the final file) before reading or writing.
// This also works for targets that do not exist yet. Never follow an in-tree symlink.
export async function assertSafePath(root: string, target: string): Promise<void> {
  const base = resolve(root);
  const path = resolve(target);
  const rel = relative(base, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path escapes ${base}: ${path}`);
  const physicalRoot = await realpath(base);
  let cursor = base;
  for (const part of rel.split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`Symlink in publication path: ${cursor}`);
      const physical = await realpath(cursor);
      const back = relative(physicalRoot, physical);
      if (back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) throw new Error(`Path escapes ${base}: ${cursor}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export async function expectedAssetBase(publicDir: string, assetsDir: string): Promise<string> {
  await assertSafePath(publicDir, assetsDir);
  // Use the physical directory when it exists; absence is an error during validation.
  const base = await realpath(publicDir);
  const assets = await realpath(assetsDir);
  const rel = relative(base, assets);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Asset directory outside public: ${assetsDir}`);
  return `/${rel.split(sep).join('/')}`;
}

// Poster files are optional author-controlled local inputs. Hash their bytes with the
// config so editing a linked file invalidates the compiled document, not just YAML edits.
export async function linkedFileDigests(config: PublicationConfig, yamlPath: string): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  const base = dirname(yamlPath);
  for (const cell of Object.values(config.cells ?? {})) for (const output of Object.values(cell.outputs ?? {})) {
    const poster = output.poster;
    if (!poster || /^https:\/\//.test(poster)) continue;
    if (isAbsolute(poster) || poster.includes('\\') || poster.includes('?') || poster.includes('#') || poster.split('/').some((part) => part === '..' || part === '.' || part === '') || /^[a-z]+:/i.test(poster)) {
      throw new Error(`Invalid local poster path: ${poster}`);
    }
    const file = resolve(base, poster);
    await assertSafePath(base, file);
    const bytes = await readFile(file);
    digests[poster] = createHash('sha256').update(bytes).digest('hex');
  }
  return digests;
}

export async function validateMarimo(): Promise<void> {
  const errors: string[] = [];
  let checked = 0;
  for (const section of sections) {
    const contentDir = join(blogRoot, 'content', section);
    await assertSafePath(blogRoot, contentDir);
    const names = await readdir(contentDir);
    const yamlSlugs = new Set<string>();
    const jsonSlugs = new Set<string>();
    const allSlugs = new Map<string, string[]>();
    for (const name of names) {
      const yaml = name.endsWith('.marimo.yaml');
      const json = name.endsWith('.marimo.json');
      if (yaml || json) {
        const slug = name.slice(0, -(yaml ? '.marimo.yaml' : '.marimo.json').length);
        if (!slugPattern.test(slug)) { errors.push(`${section}/${name}: invalid slug`); continue; }
        (yaml ? yamlSlugs : jsonSlugs).add(slug);
      }
      // Markdown and webapp JSON are also published at the same slug.
      const stem = name.replace(/(?:\.marimo\.(?:yaml|json)|\.(?:md|json))$/, '');
      if (stem !== name && !yaml) allSlugs.set(stem, [...(allSlugs.get(stem) ?? []), name]);
    }
    for (const [slug, files] of allSlugs) if (files.length > 1) errors.push(`${section}/${slug}: duplicate published slug (${files.join(', ')})`);
    for (const slug of yamlSlugs) if (!jsonSlugs.has(slug)) errors.push(`${section}/${slug}: missing compiled .marimo.json`);
    for (const slug of jsonSlugs) if (!yamlSlugs.has(slug)) errors.push(`${section}/${slug}: orphan .marimo.json (no authoring YAML)`);
    for (const slug of yamlSlugs) {
      if (!jsonSlugs.has(slug)) continue;
      const paths = publicationPaths(section, slug);
      try {
        await assertSafePath(blogRoot, contentDir);
        await assertSafePath(blogRoot, paths.publicDir);
        await assertSafePath(contentDir, paths.yaml);
        await assertSafePath(contentDir, paths.document);
        await assertSafePath(paths.publicDir, paths.assetsDir);
        const config = parseMetadataYaml(await readFile(paths.yaml, 'utf8'));
        const document = await readDocument(paths.document);
        if (config.slug !== slug || document.metadata.slug !== slug) throw new Error(`Slug differs from filename: YAML=${config.slug}, manifest=${document.metadata.slug}`);
        const linked = await linkedFileDigests(config, paths.yaml);
        if (hashPublicationConfig(config, linked) !== document.provenance.publicationConfigSha256) throw new Error('MB_STALE_CONFIG: YAML or linked poster changed; reimport this post');
        await assertSafePath(paths.publicDir, join(paths.assetsDir, '_marimo-blog-owner.json'));
        for (const asset of document.assets) await assertSafePath(paths.publicDir, join(paths.assetsDir, asset.path));
        const assetBase = await expectedAssetBase(paths.publicDir, paths.assetsDir);
        if (assetBase !== paths.assetBase) throw new Error(`Asset directory does not match slug: ${assetBase}`);
        for (const item of document.diagnostics) console.warn(`${section}/${slug}: ${item.severity} ${item.code}${item.cellId ? ` (cell ${item.cellId})` : ''}: ${item.message}`);
        const diagnostics = await verifyBuild(document, { assetsDir: paths.assetsDir, expectedAssetBase: assetBase, ownerId: paths.ownerId });
        for (const item of diagnostics) {
          const message = `${section}/${slug}: ${item.severity} ${item.code}: ${item.message}`;
          if (item.severity === 'error') errors.push(message);
          else console.warn(message);
        }
        checked++;
      } catch (error) { errors.push(`${section}/${slug}: ${String(error)}`); }
    }
  }
  if (errors.length) throw new Error(`${errors.length} marimo publication error(s):\n${errors.join('\n')}`);
  console.log(`[notebook:check] ${checked} marimo publication(s) valid`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateMarimo().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
