# @blog/notebook-parser

Jupyter notebook parser with **Quarto-compatible metadata extraction**, output utilities, and SSR-safe HTML sanitization. Used by the blog to render `.ipynb` files as project pages.

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
| `.` | High-level parser + metadata API: `parseNotebook`, `validateNotebook`, `extractMetadata`, `parseQuartoFrontmatter`, `getDefaultMetadata`, `sanitizeHtml`. |
| `./types` | `Notebook`, `NotebookCell`, `ExtractedMetadata`, `QuartoCellOptions`, `TocEntry`, `FigureReference`, output types. |
| `./utils` | `getCellSource`, `hasOutputs`, `getNotebookLanguage`, `generateTableOfContents`, `generateCellId`, `getCellOptions`, `extractFigureReferences`, `sanitizeHtml`. |

## Quarto frontmatter

The parser looks for YAML in the **first cell** (raw or markdown), delimited by `---`. Recognized fields: `title`, `author`, `date`, `description`, `categories`, `featured`, plus Quarto `format` and `execute` blocks.

If the first cell isn't frontmatter, `extractMetadata` falls back to a slug-derived title, today's date, and defaults that show all code and outputs.

## HTML sanitization

`sanitizeHtml` uses [`isomorphic-dompurify`](https://www.npmjs.com/package/isomorphic-dompurify) so the same call works under Next.js SSR (jsdom) and in the browser.

## Tests

```bash
npm -w @blog/notebook-parser run test
```

Tests use fixture `.ipynb` files. Add new fixtures for new edge cases.
