/**
 * Validate every adventure companion's frontmatter against the shared schema.
 *
 *   npm run adventure:validate
 *
 * Exits non-zero on any malformed companion. Wired into CI so a typo'd or out-of-enum
 * companion fails the build instead of silently rendering wrong.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { CONTENT_DIR } from './strava-shared';
import { validateCompanionFrontmatter } from '../lib/adventure-schema';

function main(): void {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`[adventure:validate] no content dir at ${CONTENT_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'objectives.md' && !f.startsWith('.'))
    .sort();

  const errors: string[] = [];
  for (const f of files) {
    let data: Record<string, unknown>;
    try {
      data = matter(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')).data as Record<string, unknown>;
    } catch (err) {
      errors.push(`${f}: could not parse frontmatter — ${(err as Error).message}`);
      continue;
    }
    errors.push(...validateCompanionFrontmatter(data, f));
  }

  if (errors.length > 0) {
    console.error(`\n[adventure:validate] ${errors.length} problem(s) across ${files.length} companions:\n`);
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  console.log(`[adventure:validate] ✓ ${files.length} companions valid`);
}

main();
