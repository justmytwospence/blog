/**
 * Export interactive marimo notebooks to self-hosted WebAssembly bundles.
 *
 * For every marimo notebook in content/projects/ whose frontmatter sets
 * `interactive: true`, this runs `marimo export html-wasm` into
 * public/marimo/<slug>/ (index.html + assets/). The output is COMMITTED — Vercel/CI
 * deploy it as-is; there is no build-time Python. Run after editing notebooks:
 *
 *   npm run notebooks:wasm     # then commit public/marimo/
 *
 * Code visibility reuses the notebook's existing Quarto metadata (execute.echo /
 * format.code-fold); editability comes from `interactive-mode: edit | run` (default run).
 * It also WARNS (never auto-toggles) when a notebook looks interactive but isn't flagged,
 * or is flagged but shows no interactive features, and prunes stale exports.
 *
 * marimo is invoked via `marimo` if on PATH, else `uvx marimo` (no global install needed).
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const ROOT = process.cwd();
const PROJECTS_DIR = join(ROOT, 'content', 'projects');
const OUT_ROOT = join(ROOT, 'public', 'marimo');

const isMarimo = (src) =>
  /^\s*import\s+marimo\b/m.test(src) && /marimo\.App\s*\(/.test(src);

// High-precision signals that a notebook benefits from the interactive runtime.
const INTERACTIVE_SIGNALS =
  /mo\.ui\.|mo\.state\s*\(|\.form\s*\(\s*\)|mo\.sql\s*\(|altair_chart|mpl\.interactive/;

// Pull the first triple-quoted mo.md(...) string (the frontmatter cell) and dedent it.
function readFrontmatter(src) {
  const m = src.match(/(?:mo|marimo)\.md\(\s*[rR]?("""|''')([\s\S]*?)\1/);
  if (!m) return {};
  const lines = m[2].replace(/^\n/, '').split('\n');
  let min = null;
  for (const l of lines) {
    if (!l.trim()) continue;
    const n = l.match(/^[ \t]*/)[0].length;
    if (min === null || n < min) min = n;
  }
  const content = (min ? lines.map((l) => (l.trim() ? l.slice(min) : '')) : lines).join('\n');
  if (!content.trim().startsWith('---')) return {};
  try {
    return matter(content).data || {};
  } catch {
    return {};
  }
}

// Remove the first @app.cell block if it's the frontmatter cell (its mo.md content
// starts with `---`). The blog uses that cell for metadata, but marimo would render the
// raw YAML in the WASM app — so we strip it from the exported copy (the source .py keeps
// it). Cells define nothing, so removal is safe; the source file is untouched.
function stripFrontmatterCell(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^@app\.cell\b/.test(lines[i])) continue;
    // Block runs until the next top-level @app.* / setup / __main__ construct (or EOF).
    let end = lines.length;
    for (let k = i + 1; k < lines.length; k++) {
      if (/^@app\.|^with\s+app\.setup|^if\s+__name__/.test(lines[k])) {
        end = k;
        break;
      }
    }
    const block = lines.slice(i, end).join('\n');
    const m = block.match(/(?:mo|marimo)\.md\(\s*[rR]?("""|''')([\s\S]*?)\1/);
    const firstLine = m
      ? m[2].replace(/^\n/, '').split('\n').map((s) => s.trim()).find((s) => s.length)
      : null;
    if (firstLine === '---') {
      return [...lines.slice(0, i), ...lines.slice(end)].join('\n');
    }
    break; // frontmatter is always the first cell; stop after checking it
  }
  return src;
}

// Resolve a marimo invocation: prefer `marimo` on PATH, else `uvx marimo`.
function marimoCmd(args) {
  try {
    execFileSync('marimo', ['--version'], { stdio: 'ignore' });
    return ['marimo', args];
  } catch {
    return ['uvx', ['marimo', ...args]];
  }
}

function main() {
  if (!existsSync(PROJECTS_DIR)) {
    console.log('No content/projects directory; nothing to export.');
    return;
  }

  const files = readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.py'));
  const exported = new Set();
  let warnings = 0;

  for (const file of files) {
    const slug = file.replace(/\.py$/, '');
    const src = readFileSync(join(PROJECTS_DIR, file), 'utf8');
    if (!isMarimo(src)) continue;

    const fm = readFrontmatter(src);
    const interactive = fm.interactive === true || fm.interactive === 'true';
    const looksInteractive = INTERACTIVE_SIGNALS.test(src);

    // Detection nudges — warn, never auto-decide.
    if (interactive && !looksInteractive) {
      console.warn(
        `  warn: ${file} has 'interactive: true' but no mo.ui/mo.state/mo.sql/interactive-chart usage — is the interactive build needed?`
      );
      warnings++;
    }
    if (!interactive && looksInteractive) {
      console.warn(
        `  warn: ${file} uses interactive marimo features but 'interactive: true' is not set — readers will only get the static view.`
      );
      warnings++;
    }
    if (!interactive) continue;

    // Mode (orthogonal): editability from interactive-mode; code visibility from Quarto meta.
    const mode = fm['interactive-mode'] === 'edit' ? 'edit' : 'run';
    const echo = fm.execute?.echo ?? fm.echo;
    const codeFold = fm.format?.['code-fold'] ?? fm['code-fold'];
    const hideCode = echo === false || codeFold === 'hide' || codeFold === true;

    // Export from a temp copy with the frontmatter cell stripped, so the WASM app
    // doesn't render the raw YAML. PEP 723 deps + all real cells are preserved.
    const tmpDir = mkdtempSync(join(tmpdir(), 'marimo-wasm-'));
    const tmpPy = join(tmpDir, `${slug}.py`);
    writeFileSync(tmpPy, stripFrontmatterCell(src), 'utf8');

    const outDir = join(OUT_ROOT, slug);
    const args = [
      'export',
      'html-wasm',
      tmpPy,
      '-o',
      outDir,
      '--mode',
      mode,
      hideCode ? '--no-show-code' : '--show-code',
      '-f',
    ];
    const [cmd, cmdArgs] = marimoCmd(args);
    console.log(`  export: ${slug} (mode=${mode}, ${hideCode ? 'no-show-code' : 'show-code'})`);
    execFileSync(cmd, cmdArgs, { stdio: 'inherit' });
    rmSync(tmpDir, { recursive: true, force: true });

    // marimo drops a dev-assistant CLAUDE.md template into the export; not for serving.
    const stray = join(outDir, 'CLAUDE.md');
    if (existsSync(stray)) rmSync(stray, { force: true });

    exported.add(slug);
  }

  // Prune stale exports (notebook removed or no longer interactive).
  if (existsSync(OUT_ROOT)) {
    for (const entry of readdirSync(OUT_ROOT)) {
      const p = join(OUT_ROOT, entry);
      if (statSync(p).isDirectory() && !exported.has(entry)) {
        console.log(`  prune:  public/marimo/${entry} (no longer an interactive notebook)`);
        rmSync(p, { recursive: true, force: true });
      }
    }
  }

  console.log(
    `Done: ${exported.size} interactive export(s)${warnings ? `, ${warnings} warning(s)` : ''}. Commit public/marimo/.`
  );
}

main();
