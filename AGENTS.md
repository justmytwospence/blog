# AGENTS.md

Non-discoverable operational context for AI coding agents. Everything here is something you **cannot** figure out by reading the codebase.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build — always verify changes build cleanly
npm run test         # Vitest (--run mode)
npm run lint         # ESLint via Next.js
```

## Gotchas

- **Monorepo workspace**: This project uses npm workspaces. The notebook parser lives in `packages/notebook-parser/` as `@blog/notebook-parser`. Import from `@blog/notebook-parser`, `@blog/notebook-parser/types`, or `@blog/notebook-parser/utils` — not from `lib/notebook/`. Next.js `transpilePackages` compiles the raw TypeScript.
- **ISR, not static export**: The site no longer uses `output: 'export'`. Most pages are statically generated at build time. Pages with external data (blogroll, reading, about) use ISR with `revalidate = 3600` to refresh hourly. No API routes, no `getServerSideProps` — still no server-only features except ISR. The `generateStaticParams()` requirement still applies for dynamic routes.
- **Notebook metadata**: The first cell of `.ipynb` files must be a raw or markdown cell containing Quarto-style YAML frontmatter. If you create test notebooks, include this or metadata extraction silently returns empty.
- **Concepts registry**: Components in `/components/concepts/index.ts` use `next/dynamic` with `ssr: false` because they rely on browser APIs (canvas, window). Don't switch to regular imports or the build breaks.
- **Custom Tailwind breakpoints**: `md-toc` and `code-80` are project-specific breakpoints defined in `globals.css`, not standard Tailwind. Don't remove them — the TOC responsive layout depends on them.
- **Syntax highlighting themes**: Dark uses VS Code Dark+ colors, light uses Solarized Light. Both are defined as CSS custom properties in `globals.css`. Don't add highlight.js theme CSS files — the theming is manual.
- **Content parser coupling**: `lib/content.ts` handles blog, projects, concepts, and pages with shared parsing logic. Content type differences (e.g., concepts have `component` field, projects have `externalUrl`) are handled in the same functions — don't split into separate parsers without understanding the shared frontmatter pipeline.

## Polypane MCP

When connected to Polypane via Chrome DevTools MCP:
- Multiple panes showing the same URL are different **viewports** in a single tab, not separate pages.
- Get pane names via `window.__polypane.title`.
- Apply snapshots/scripts to all panes in parallel for multi-viewport testing.
- Filter out internal URLs starting with `polypane://` or containing `/resources/app.asar/`.

## Testing

- All tests: `npm run test`
- Package tests: `npm -w @blog/notebook-parser run test`
- Single test file: `npx vitest run packages/notebook-parser/__tests__/parser.test.ts`
- Notebook parser tests use fixture `.ipynb` files — if you add edge cases, add fixtures too.
