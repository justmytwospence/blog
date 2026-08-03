# AGENTS.md

Non-discoverable operational context for AI coding agents. Everything here is something you **cannot** figure out by reading the codebase.

## Workflow

Solo project — **no PRs**. Commit directly to `main` (atomic, conventional messages); pushing `main`
triggers the Vercel production deploy. Branches/worktrees are for genuinely parallel or experimental
work only, and get merged locally (no GitHub review flow). CI still runs on every push.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build — always verify changes build cleanly
npm run lint         # ESLint flat config (eslint-config-next 16)
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (--run mode)
```

CI runs all four on every push and PR (`.github/workflows/ci.yml`).

### Strava data pipeline

Two layers, split by what's committed:

- **Committed (build reads these, never calls Strava at build):** the rich per-activity snapshots
  `data/adventures/activities/*.json` (trip reports, photos, polylines). `npm run sync:strava` is the
  one idempotent authoring command. It **change-detects cheaply**: ONE summary crawl (~a handful of
  GETs) yields a `summaryHash` per activity, and only ids whose hash diverges (or are new/forced) get a
  per-activity detail fetch — unchanged ids cost **zero** detail calls. (A description-only Strava edit
  doesn't move `summaryHash`; reconcile with `-- --force`.) Flags: `-- --only <id[,id]>` syncs just
  those ids (O(1) — what `adventure:new` uses), `-- --force` re-fetches all, `-- --reindex` rebuilds the
  index from full history, `-- --retry-enrichment` heals missing weather/geocode without a detail call.
  Pre-schema snapshots get `summaryHash`/`workoutType` backfilled from the crawl (no detail call). It
  also refreshes the gitignored index + totals.
- **Derived vs editorial (companion frontmatter):** the pipeline derives everything unambiguous from
  the snapshot — `sport`, `title`, `date`, `peakClass`, facets, lap counts, and **`race`** (from Strava
  `workout_type`: Run 1 / Ride 11); `adventure:new` auto-attaches `group`/`laps` by GPS trailhead
  (`scripts/route-match.ts`). Frontmatter carries only editorial deltas (`type`, `difficulty`, `tags`,
  `objective`, `featured`, `cover_photo`, `days[].title`, non-run/ride `race`) plus intentional
  overrides. `npm run adventure:minimize` strips derivable/dead keys; `adventure:validate` warns on
  drift. The `new-adventure` skill is the agent workflow — discover via the Strava MCP, gather the
  editorial fields, run the scripts; **do NOT re-derive what the pipeline derives.**
- **NOT committed — runtime store:** the rolling totals (`lifetime-totals.json` / `yearly-totals.json`)
  and the index are **gitignored** (`.gitignore`). In production the totals live in **Upstash Redis**
  (`strava:totals`), written by the webhook (`app/api/strava/webhook`) on each activity event and by a
  daily reconcile cron (`app/api/strava/reconcile`, scheduled in `vercel.json`) as a safety net for a
  dropped event. Both call the shared `recomputeTotals()` in `lib/strava-store.ts`. Pages read the
  store at render; with no Redis (dev/CI) they fall back to the gitignored local totals file or an
  empty state. **`docs/strava-stats.md` is the source of truth** for setup/seeding/rotation.
- Standalone scripts: `npm run sync:index` and `npm run totals:build` (chained as `totals:refresh`);
  `npm run seed:redis` bootstraps the Upstash store; `npm run webhook:subscribe` / `webhook:view` /
  `webhook:delete` manage the Strava push subscription (one per app).
- **Strava MCP** (`strava` server — **local** scope in `~/.claude.json`, i.e. private to this project,
  not user-wide; re-add it with `claude mcp add --transport http strava <url> -s local` if it goes
  missing): the read/analysis surface for discovery. Because MCPJungle namespaces by tool group, the
  names carry a **doubled** prefix — `mcp__strava__strava__strava_list_activities`,
  `..._get_activity`, `..._get_athlete_stats` (server `strava` + group `strava` + tool
  `strava_*`), not the single-prefix form. It never touches the repo and authenticates with its own
  credential copy of the same Strava app — it does NOT share `.env.local`/`.strava-token.json`.
  The backend is a self-hosted homelab **MCPJungle** proxy exposing the `strava` tool group, currently
  at `https://strava.mcp.spencerboucher.com/mcp` (it previously lived at `mcp-gateway.spencerboucher.com`;
  the hostname has moved once already, so treat it as mutable). **Diagnosing a dead server:** the
  reverse proxy answers for every `*.spencerboucher.com` name, so a wrong/retired host does not fail
  DNS or TLS — it falls through to a default site that returns `405 Method Not Allowed` (`allow: GET,
  HEAD`) on the MCP `POST`. That 405 means *no MCP server is routed at this host*, not that the server
  is broken. Confirm the proxy and homelab are healthy by POSTing an `initialize` to a known-good
  sibling (`https://obsidian.mcp.spencerboucher.com/`); a real MCP endpoint returns a JSON-RPC result
  naming the server.
- **Token multi-store hazard:** the Strava refresh token lives in independent stores — blog `.env.local`
  / `.strava-token.json`, prod Redis `strava:auth`, and the MCP gateway — and Strava can rotate it on
  refresh, invalidating the others. Break-glass: `DEL strava:auth` + `npm run seed:redis` (prod), or
  refresh `.env.local` (local). See `docs/strava-stats.md`.
- **Deprecated, local-only, gitignored** one-time bootstrapping (kept for occasional re-auth/triage, intentionally out of version control): `scripts/strava-bootstrap.ts` (OAuth), `scripts/strava-sweep.ts` (full-history triage), `scripts/strava-inbox.ts` (stub scaffolding). Run via `npx tsx scripts/<name>.ts`. Don't wire them back into the build; the sweep still writes an older totals format.

## Gotchas

- **npm workspaces**: Domain integrations live in `packages/`. Always import from the package name, never from internal paths or `lib/`. Next.js `transpilePackages` compiles the raw TypeScript.
  - `@blog/notebook-parser` (+ `/types`, `/utils`) — Jupyter parsing, Quarto metadata, output utilities
  - `@blog/hardcover` (+ `/types`) — Hardcover GraphQL client (reading list)
  - `@blog/obsidian-md` — Obsidian markdown preprocessor
  - `@blog/inoreader` — Inoreader RSS client (blogroll)
- **ISR, not static export**: The site no longer uses `output: 'export'`. Most pages are statically generated at build time. Pages with external data (blogroll, reading, about) use ISR with `revalidate = 3600`. `/projects/[slug]` is server-rendered on demand to keep the Vercel cache small. The `generateStaticParams()` requirement still applies for dynamic SSG routes.
- **Live external data + last-good resilience**: The four live integrations (GitHub `/projects`, Hardcover `/reading` + `/about`, Inoreader `/blogroll` + `/blogroll.xml`, Strava `/adventures`) all render via ISR (`revalidate = 3600`), so an upstream API is hit at most ~once/hr/page regardless of traffic — **never make these routes `force-dynamic`** or every request hits the upstream. Resilience is consistent but per-integration, not a shared framework: the one shared piece is `lib/last-good.ts` `readThrough(key, fetcher)`, an Upstash-backed read-through cache that serves the last successful payload when the fetcher throws (and is a no-op pass-through with no Redis env). Because packages can't import `lib/`, the package exposes a throwing `*OrThrow` variant and the **app-layer** page wraps it in `readThrough` (a returned `[]` is treated as success — failure must throw). GitHub/Hardcover/Inoreader are poll-only (no webhooks); only Strava pushes. Hardcover's token expires annually (Jan 1, manual rotation — watch for `[hardcover] AUTH FAILURE`). Inoreader feed identity is env-config (`INOREADER_USER_ID` / `INOREADER_PUBLIC_TAG` / `INOREADER_FEED_ITEM_COUNT`).
- **Notebook metadata**: The first cell of `.ipynb` files must be a raw or markdown cell containing Quarto-style YAML frontmatter. If you create test notebooks, include this or metadata extraction silently returns empty.
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
