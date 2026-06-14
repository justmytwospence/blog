/**
 * marimo notebook parser
 *
 * marimo notebooks are stored as pure Python files (`.py`), not JSON: cells are
 * `@app.cell`-decorated functions, markdown is `mo.md("...")`, and crucially the file
 * stores NO computed outputs. This module converts a marimo `.py` source into the same
 * `Notebook` structure produced by the Jupyter parser, so the existing Quarto-style
 * rendering pipeline (metadata extraction, ToC, cell/markdown rendering, `#|` directives)
 * works unchanged. Code cells are emitted with empty `outputs` — marimo's interactive
 * outputs are out of scope for the static render (see the WASM-embed follow-up).
 *
 * The parser is a line/indent state machine, not a Python AST. It relies on marimo's
 * deterministic formatting (consistent 4-space indentation, one auto-generated `return`
 * per cell), which holds for files written/saved by marimo.
 */

import { readFileSync } from 'fs';
import { Notebook, NotebookCell } from './types';
import { validateNotebook } from './validator';

/**
 * Detect whether a `.py` source is a marimo notebook (vs an ordinary script).
 *
 * @param src - File contents
 * @returns True if the source imports marimo and constructs a `marimo.App`
 */
export function isMarimoSource(src: string): boolean {
  if (typeof src !== 'string') return false;
  return /^\s*import\s+marimo\b/m.test(src) && /marimo\.App\s*\(/.test(src);
}

/**
 * Parse a marimo notebook file from disk into a `Notebook`.
 *
 * Mirrors the error semantics of the Jupyter `parseNotebook`.
 *
 * @param filePath - Absolute path to the `.py` file
 * @returns Parsed and validated notebook (code cells have empty outputs)
 * @throws Error if the file is not found
 */
export function parseMarimoNotebook(filePath: string): Notebook {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    return parseMarimoFromString(fileContent);
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Notebook file not found: ${filePath}`);
      }
      throw error;
    }
    throw new Error(`Failed to read notebook file: ${filePath}`);
  }
}

/**
 * Parse marimo `.py` source into a `Notebook`. Pure and testable.
 *
 * @param src - marimo notebook source
 * @returns Parsed and validated notebook
 */
export function parseMarimoFromString(src: string): Notebook {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const cells: NotebookCell[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank lines between top-level constructs
    if (line.trim() === '') {
      i++;
      continue;
    }

    // PEP 723 inline-metadata block: `# /// script` ... `# ///`
    if (/^#\s*\/\/\//.test(line)) {
      i++;
      while (i < lines.length && !/^#\s*\/\/\//.test(lines[i])) i++;
      i++; // consume the closing `# ///`
      continue;
    }

    // Module boilerplate (single logical statements — may span lines)
    if (
      /^import\s+marimo\b/.test(line) ||
      /^__generated_with\s*=/.test(line) ||
      /^app\s*=\s*marimo\.App\s*\(/.test(line)
    ) {
      i = findLogicalEnd(lines, i) + 1;
      continue;
    }

    // `if __name__ == "__main__":` + `app.run()` — nothing meaningful follows
    if (/^if\s+__name__\s*==/.test(line)) {
      break;
    }

    // `@app.cell` (optionally with args, possibly multi-line)
    if (/^@app\.cell\b/.test(line)) {
      const decoratorEnd = findLogicalEnd(lines, i);
      const decoratorText = lines.slice(i, decoratorEnd + 1).join('\n');
      const flags = parseDecoratorFlags(decoratorText);

      const defStart = decoratorEnd + 1;
      const defEnd = findLogicalEnd(lines, defStart); // line with the closing `)` of params
      const bodyStart = defEnd + 1;
      const { body, next } = collectBody(lines, bodyStart);
      i = next;

      const cell = buildAppCell(body, flags, cells.length);
      if (cell) cells.push(cell);
      continue;
    }

    // `@app.function` / `@app.class_definition` — keep the def/class verbatim as code
    if (/^@app\.(function|class_definition)\b/.test(line)) {
      const decoratorEnd = findLogicalEnd(lines, i);
      const defStart = decoratorEnd + 1;
      const defEnd = findLogicalEnd(lines, defStart);
      const headerLines = lines.slice(defStart, defEnd + 1);
      const { body, next } = collectBody(lines, defEnd + 1);
      i = next;

      const source = trimBlankEdges([...headerLines, ...body]).join('\n');
      if (source.trim() !== '') cells.push(makeCodeCell(source, {}, cells.length));
      continue;
    }

    // `with app.setup:` — show the setup body as a code cell (drop the `with` wrapper)
    if (/^with\s+app\.setup\s*:/.test(line)) {
      const { body, next } = collectBody(lines, i + 1);
      i = next;
      const source = dedentBody(trimBlankEdges(body).join('\n'));
      if (source.trim() !== '') cells.push(makeCodeCell(source, {}, cells.length));
      continue;
    }

    // Unknown top-level line (stray comment/import) — skip it
    i++;
  }

  const notebook: Notebook = {
    cells,
    metadata: {
      language_info: { name: 'python' },
      kernelspec: { name: 'python3', language: 'python', display_name: 'Python 3' },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };

  validateNotebook(notebook);
  return notebook;
}

// ---------------------------------------------------------------------------
// Cell construction
// ---------------------------------------------------------------------------

interface DecoratorFlags {
  hideCode?: boolean;
  disabled?: boolean;
}

/**
 * Turn the body of an `@app.cell` into a markdown or code cell.
 * Returns null when the cell is empty (only the auto-generated return).
 */
function buildAppCell(
  bodyLines: string[],
  flags: DecoratorFlags,
  index: number
): NotebookCell | null {
  const dedented = dedentBody(bodyLines.join('\n'));
  const source = stripAutoReturn(dedented);
  if (source.trim() === '') return null;

  // Markdown cell: the body is exactly `mo.md("<literal>")` with no `#|` directives.
  const md = parseMoMd(source);
  if (md !== null) {
    return {
      cell_type: 'markdown',
      source: md,
      metadata: {},
      id: `cell-${index}`,
    };
  }

  const metadata = flagsToMetadata(flags);
  // Tag SQL cells for a future renderer hint (harmless extra metadata key).
  if (/(?:^|[^.\w])mo\.sql\s*\(/.test(source)) {
    metadata['marimo-kind'] = 'sql';
  }
  return makeCodeCell(source, metadata, index);
}

function makeCodeCell(
  source: string,
  metadata: NonNullable<NotebookCell['metadata']>,
  index: number
): NotebookCell {
  return {
    cell_type: 'code',
    source,
    metadata,
    outputs: [],
    execution_count: null,
    id: `cell-${index}`,
  };
}

function flagsToMetadata(flags: DecoratorFlags): NonNullable<NotebookCell['metadata']> {
  const metadata: NonNullable<NotebookCell['metadata']> = {};
  // marimo `hide_code` -> collapsed-but-expandable code, matching its intent.
  if (flags.hideCode) metadata['code-fold'] = 'hide';
  if (flags.disabled) {
    metadata['code-fold'] = 'hide';
    metadata['marimo-disabled'] = true;
  }
  return metadata;
}

function parseDecoratorFlags(decoratorText: string): DecoratorFlags {
  return {
    hideCode: /\bhide_code\s*=\s*True\b/.test(decoratorText),
    disabled: /\bdisabled\s*=\s*True\b/.test(decoratorText),
  };
}

// ---------------------------------------------------------------------------
// Markdown extraction
// ---------------------------------------------------------------------------

/**
 * If `body` is a single bare `mo.md(<string literal>)` call (no `#|` directives,
 * not an f-string / variable / concatenation), return the processed markdown content.
 * Otherwise return null (caller treats the cell as code).
 */
function parseMoMd(body: string): string | null {
  if (/^#\|/m.test(body)) return null; // per-cell Quarto directives -> code cell

  const t = stripLeadingNoise(body).trim();
  const open = t.match(/^(?:mo|marimo)\.md\(/);
  if (!open) return null;

  const rest = t.slice(open[0].length).replace(/^\s*/, '');
  const lit = readStringLiteral(rest);
  if (!lit) return null;

  let after = rest.slice(lit.raw.length).replace(/^\s*,?\s*/, '');
  if (!after.startsWith(')')) return null;
  after = after.slice(1).trim();
  if (after !== '') return null; // anything after the call -> not a pure markdown cell

  return processMarkdown(lit.content, lit.isRaw);
}

interface StringLiteral {
  content: string;
  isRaw: boolean;
  raw: string; // the matched literal text incl. quotes
}

/**
 * Read a Python string literal at the start of `s`. Supports raw (`r`) and
 * triple/single quoted forms. f-strings are intentionally NOT matched (the leading
 * `f`/`rf`/`fr` prefix fails the prefix group), so they fall back to code cells.
 */
function readStringLiteral(s: string): StringLiteral | null {
  const m = s.match(/^([rR]?)("""|'''|"|')/);
  if (!m) return null;
  const isRaw = m[1].toLowerCase() === 'r';
  const quote = m[2];
  const startContent = m[0].length;

  if (quote.length === 3) {
    let idx = startContent;
    for (;;) {
      const next = s.indexOf(quote, idx);
      if (next === -1) return null;
      if (!isRaw && trailingBackslashes(s, next) % 2 === 1) {
        idx = next + 1;
        continue;
      }
      return { content: s.slice(startContent, next), isRaw, raw: s.slice(0, next + 3) };
    }
  }

  // single/double quoted — must terminate on the same line
  let i = startContent;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && !isRaw) {
      i += 2;
      continue;
    }
    if (ch === '\n') return null;
    if (ch === quote) {
      return { content: s.slice(startContent, i), isRaw, raw: s.slice(0, i + 1) };
    }
    i++;
  }
  return null;
}

function processMarkdown(content: string, isRaw: boolean): string {
  let c = content;
  if (!isRaw) {
    c = c.replace(/\\([\\'"ntr])/g, (_, ch: string) => {
      switch (ch) {
        case 'n':
          return '\n';
        case 't':
          return '\t';
        case 'r':
          return '\r';
        default:
          return ch; // \\  \'  \"
      }
    });
  }
  c = c.replace(/^\n/, ''); // marimo opens triple-quoted md with a newline
  c = dedent(c); // md is indented to the cell body; dedent so `#`/`:::` sit at col 0
  return c.replace(/[ \t\n]+$/, '');
}

// ---------------------------------------------------------------------------
// Line/indent helpers
// ---------------------------------------------------------------------------

/**
 * Index of the last line of the logical statement starting at `start`, balancing
 * (), [], {}. Naive (ignores string contents) but sufficient for marimo decorators,
 * `def` signatures, and the `app = marimo.App(...)` / boilerplate lines it is used on.
 */
function findLogicalEnd(lines: string[], start: number): number {
  let depth = 0;
  for (let j = start; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
    }
    if (depth <= 0) return j;
  }
  return lines.length - 1;
}

/**
 * Track triple-quoted string state across a line. Given the active delimiter (or null),
 * scans the line toggling in/out of `"""` / `'''` strings and returns the delimiter still
 * open at end of line (or null). Pragmatic: ignores `#` comments and single-quoted strings,
 * which is fine for marimo cell bodies (the goal is not to break out mid-`mo.md` string).
 */
function scanTriple(line: string, delim: string | null): string | null {
  let i = 0;
  while (i < line.length) {
    if (delim) {
      const idx = line.indexOf(delim, i);
      if (idx === -1) return delim; // string continues onto the next line
      i = idx + 3;
      delim = null;
    } else {
      const d1 = line.indexOf('"""', i);
      const d2 = line.indexOf("'''", i);
      if (d1 === -1 && d2 === -1) return null;
      const useDq = d2 === -1 || (d1 !== -1 && d1 < d2);
      delim = useDq ? '"""' : "'''";
      i = (useDq ? d1 : d2) + 3;
    }
  }
  return delim;
}

/**
 * Collect a block body starting at `start`. A line belongs to the body if it is blank or
 * indented; the body ends at the next column-0 non-blank line — UNLESS that line is inside
 * a triple-quoted string (e.g. column-0 markdown inside `mo.md(r"""..."""`), which marimo
 * generated files indent but hand-written ones may not).
 */
function collectBody(lines: string[], start: number): { body: string[]; next: number } {
  const body: string[] = [];
  let j = start;
  let delim: string | null = null;
  while (j < lines.length) {
    const l = lines[j];
    if (delim === null && l.trim() !== '' && !/^\s/.test(l)) {
      break; // top-level line, not inside a string → end of body
    }
    body.push(l);
    delim = scanTriple(l, delim);
    j++;
  }
  return { body, next: j };
}

/**
 * Remove marimo's auto-generated trailing `return` (e.g. `return`, `return (a, b)`,
 * `return a, b`). Only strips a return at the outermost indent that is the cell's last
 * statement; never a nested return.
 */
function stripAutoReturn(text: string): string {
  let lines = trimTrailingBlank(text.split('\n'));
  if (lines.length === 0) return '';

  const last = lines[lines.length - 1];
  if (/^return(\s.*)?$/.test(last) && isBalanced(last)) {
    lines.pop();
  } else if (last.trim() === ')') {
    // multi-line return spanning to a closing paren
    let s = lines.length - 1;
    while (s >= 0 && !/^return\b/.test(lines[s])) s--;
    if (s >= 0) lines = lines.slice(0, s);
  }

  return trimTrailingBlank(lines).join('\n');
}

/** Strip a leading run of blank/comment lines (used only for markdown detection). */
function stripLeadingNoise(text: string): string {
  const lines = text.split('\n');
  let k = 0;
  while (k < lines.length && (lines[k].trim() === '' || lines[k].trim().startsWith('#'))) k++;
  return lines.slice(k).join('\n');
}

/**
 * Dedent a cell body by the *function-body* indent (the first non-blank line's indent),
 * removing at most that many leading whitespace chars per line. Unlike `dedent` (common
 * minimum), this is correct for ragged bodies where a `mo.md(r"""..."""` string's content
 * sits at a shallower indent than the code (e.g. column-0 markdown in hand-written files):
 * the code lines drop to column 0 while the string interior is left intact for
 * `processMarkdown` to dedent on its own.
 */
function dedentBody(text: string): string {
  const lines = text.split('\n');
  const first = lines.find((l) => l.trim() !== '');
  if (!first) return text;
  const indent = (first.match(/^[ \t]*/) as RegExpMatchArray)[0].length;
  if (!indent) return text;
  return lines
    .map((l) => {
      const w = (l.match(/^[ \t]*/) as RegExpMatchArray)[0].length;
      return l.slice(Math.min(w, indent));
    })
    .join('\n');
}

/** textwrap.dedent equivalent: remove the common leading whitespace from all lines. */
function dedent(text: string): string {
  const lines = text.split('\n');
  let min: number | null = null;
  for (const l of lines) {
    if (l.trim() === '') continue;
    const indent = (l.match(/^[ \t]*/) as RegExpMatchArray)[0].length;
    if (min === null || indent < min) min = indent;
  }
  if (!min) return lines.map((l) => (l.trim() === '' ? '' : l)).join('\n');
  const n = min;
  return lines.map((l) => (l.trim() === '' ? '' : l.slice(n))).join('\n');
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}

function trimTrailingBlank(lines: string[]): string[] {
  const out = lines.slice();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

function isBalanced(line: string): boolean {
  let depth = 0;
  for (const ch of line) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
  }
  return depth === 0;
}

function trailingBackslashes(s: string, pos: number): number {
  let count = 0;
  let i = pos - 1;
  while (i >= 0 && s[i] === '\\') {
    count++;
    i--;
  }
  return count;
}
