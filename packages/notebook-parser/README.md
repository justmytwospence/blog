# @blog/notebook-parser

Jupyter (`.ipynb`) **and marimo (`.py`)** notebook parser with **Quarto-compatible metadata extraction**, output utilities, and SSR-safe HTML sanitization. Both notebook formats are parsed into the same `Notebook` shape, so the blog renders them through one Quarto-style pipeline.

## Install

This is a private workspace package. Inside the monorepo:

```ts
import { parseNotebook, extractMetadata } from '@blog/notebook-parser';
import type { Notebook, ExtractedMetadata } from '@blog/notebook-parser/types';
import { sanitizeHtml, generateTableOfContents } from '@blog/notebook-parser/utils';
```

## Subpath exports

| Subpath | What's there |
|---|---|
| `.` | High-level parser + metadata API: `parseNotebook`, `parseMarimoNotebook`, `parseMarimoFromString`, `isMarimoSource`, `validateNotebook`, `extractMetadata`, `parseQuartoFrontmatter`, `getDefaultMetadata`, `sanitizeHtml`. |
| `./types` | `Notebook`, `NotebookCell`, `ExtractedMetadata`, `QuartoCellOptions`, `TocEntry`, `FigureReference`, output types. |
| `./utils` | `getCellSource`, `hasOutputs`, `getNotebookLanguage`, `generateTableOfContents`, `generateCellId`, `getCellOptions`, `extractFigureReferences`, `sanitizeHtml`. |

## Quarto frontmatter

The parser looks for YAML in the **first cell** (raw or markdown), delimited by `---`. Recognized fields: `title`, `author`, `date`, `description`, `categories`, `featured`, plus Quarto `format` and `execute` blocks.

If the first cell isn't frontmatter, `extractMetadata` falls back to a slug-derived title, today's date, and defaults that show all code and outputs.

## marimo notebooks (`.py`)

`parseMarimoNotebook(filePath)` / `parseMarimoFromString(src)` convert a marimo notebook
into the same `Notebook` structure as the Jupyter parser (use `isMarimoSource(src)` to
distinguish a marimo file from an ordinary script). The parser is pure TypeScript — no
Python, no execution.

- **Frontmatter** goes in the **first `mo.md` cell** as a `---` YAML block. Make that cell
  frontmatter-only (no trailing prose) — like `.ipynb`, the first cell is sliced off before
  rendering. Put intro prose in a second markdown cell.
- **Markdown cells** are `mo.md("""...""")` calls. The string is dedented so headings,
  callouts, and `#|`-style content land at column 0. **Dynamic** markdown (`mo.md(var)`,
  f-strings, concatenation) is rendered as a code cell instead — use literal strings for
  prose.
- **Per-cell Quarto directives** (`#| echo: false`, `#| fig-cap: ...`) work in code cells,
  same as Jupyter. marimo's `@app.cell(hide_code=True)` / `disabled=True` map to
  `code-fold: hide`.
- **Outputs are not stored** in marimo files, so code cells render with no output. SQL
  cells (`mo.sql(...)`), `@app.function`, `@app.class_definition`, and `with app.setup:`
  blocks render as code cells.

## HTML sanitization

`sanitizeHtml` uses [`isomorphic-dompurify`](https://www.npmjs.com/package/isomorphic-dompurify) so the same call works under Next.js SSR (jsdom) and in the browser.

## Tests

```bash
npm -w @blog/notebook-parser run test
```

Tests use fixture `.ipynb` files. Add new fixtures for new edge cases.
