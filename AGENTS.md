# AGENTS.md

Non-discoverable operational context for AI coding agents. Everything here is something you **cannot** figure out by reading the codebase.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build — always verify changes build cleanly
npm run lint         # ESLint flat config (eslint-config-next 16)
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (--run mode)
```

CI runs all four on every push and PR (`.github/workflows/ci.yml`).

## Gotchas

- **npm workspaces**: Domain integrations live in `packages/`. Always import from the package name, never from internal paths or `lib/`. Next.js `transpilePackages` compiles the raw TypeScript.
  - `@blog/notebook-parser` (+ `/types`, `/utils`) — Jupyter (`.ipynb`) and marimo (`.py`) parsing, Quarto metadata, output utilities
  - `@blog/hardcover` (+ `/types`) — Hardcover GraphQL client (reading list)
  - `@blog/obsidian-md` — Obsidian markdown preprocessor
  - `@blog/inoreader` — Inoreader RSS client (blogroll)
- **ISR, not static export**: The site no longer uses `output: 'export'`. Most pages are statically generated at build time. Pages with external data (blogroll, reading, about) use ISR with `revalidate = 3600`. `/projects/[slug]` is server-rendered on demand to keep the Vercel cache small. The `generateStaticParams()` requirement still applies for dynamic SSG routes.
- **Notebook metadata**: The first cell of `.ipynb` files must be a raw or markdown cell containing Quarto-style YAML frontmatter. If you create test notebooks, include this or metadata extraction silently returns empty.
- **marimo notebooks**: `content/projects/*.py` that are marimo notebooks (detected via `isMarimoSource` — must `import marimo` and build a `marimo.App`) are parsed by `@blog/notebook-parser`'s `parseMarimoNotebook` into the same `Notebook` shape and rendered at `/projects/[slug]`. Put Quarto frontmatter in the **first `mo.md` cell** as a frontmatter-only `---` YAML block. marimo files store no outputs, so code cells render without output. Non-marimo `.py` scripts in `content/projects/` are ignored. `lib/content.ts` tags notebooks `notebookEngine: 'marimo' | 'jupyter'`.
- **Interactive marimo (WASM)**: a marimo notebook with `interactive: true` in its frontmatter renders as a live in-browser (Pyodide) `<iframe>` instead of the static view (`app/projects/[slug]/page.tsx` gates on `notebookEngine === 'marimo' && interactive`; `MarimoEmbed` swaps the SSR static fallback for the iframe on mount). Generate the embed with `npm run notebooks:wasm` (`scripts/export-marimo-wasm.mjs`, via `marimo`/`uvx marimo` — local only, never CI) and **commit** the `public/marimo/<slug>/` output (~25–30 MB each). The route gates on the flag, NOT a runtime `fs` check (Vercel doesn't ship `public/` to the lambda). `next.config.mjs` scopes `X-Frame-Options` to `SAMEORIGIN` for `/marimo/*` (the global `DENY` would block the same-origin iframe); no COOP/COEP needed. Editability: `interactive-mode: edit | run` (default `run`); code visibility reuses `execute.echo`/`format.code-fold`.
- **Notebook HTML sanitization**: Notebook HTML output is sanitized via `isomorphic-dompurify` inside `@blog/notebook-parser/utils#sanitizeHtml`. The function is SSR-safe.
- **Concepts registry**: Components in `/components/concepts/index.ts` use `next/dynamic` with `ssr: false` because they rely on browser APIs (canvas, window). Don't switch to regular imports or the build breaks.
- **Custom Tailwind breakpoints**: `md-toc` and `code-80` are project-specific breakpoints defined in `globals.css`, not standard Tailwind. Don't remove them — the TOC responsive layout depends on them.
- **Syntax highlighting themes**: Dark uses VS Code Dark+ colors, light uses Solarized Light. Both are defined as CSS custom properties in `globals.css`. Don't add highlight.js theme CSS files — the theming is manual.
- **Per-page metadata titles**: `app/layout.tsx` sets a `'%s — Data Spencer'` title template. Per-page `metadata.title` exports just provide the page name (`'Blog'`, `'Projects'`, etc.); the template fills in the suffix.
- **Content parser coupling**: `lib/content.ts` still handles blog, projects, and concepts with shared parsing logic. Content type differences (concepts have `component`, projects have `externalUrl`) are handled in the same functions — don't split into separate parsers without understanding the shared frontmatter pipeline. Reading-time math goes through one helper (`calculateReadingTime`) — reuse it, don't recompute.
- **Lint rule downgrades**: React Compiler-style rules from `react-hooks` v6 (`refs`, `immutability`, `static-components`, `set-state-in-*`, `purity`) are downgraded to warnings in `eslint.config.mjs` because the existing canvas/concept components trip them harmlessly. `rules-of-hooks` is still an error.

## Polypane MCP

When connected to Polypane via Chrome DevTools MCP:
- Multiple panes showing the same URL are different **viewports** in a single tab, not separate pages.
- Get pane names via `window.__polypane.title`.
- Apply snapshots/scripts to all panes in parallel for multi-viewport testing.
- Filter out internal URLs starting with `polypane://` or containing `/resources/app.asar/`.

## Testing

- All tests: `npm run test`
- One workspace package: `npm -w @blog/notebook-parser run test` (or `-w @blog/hardcover`, etc.)
- Single test file: `npx vitest run packages/notebook-parser/__tests__/parser.test.ts`
- Notebook parser tests use fixture `.ipynb` files — if you add edge cases, add fixtures too.
- React component tests are intentionally not wired up yet (vitest is `environment: 'node'`, no jsdom).
