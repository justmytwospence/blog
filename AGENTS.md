# AGENTS.md

Non-discoverable operational context for AI coding agents. Everything here is something you **cannot** figure out by reading the codebase.

## Workflow

Solo project — **no PRs**. Git is the deployment source of truth:

| Branch | Deployment |
| --- | --- |
| `main` | Production; apex redirects to `www.spencerboucher.com` |
| `dev` | Shared review at `https://dev.spencerboucher.com` |
| Bare-slug feature branch | Vercel preview; its build adds `https://<branch>.dev.spencerboucher.com` itself |

Work on `dev`, with feature branches for independent work. After lint/typecheck/test/build pass,
commit atomically and use `npm run preview:push` for a routine preview push **without another ask**.
It validates this repo's origin and pushes only the current nonproduction branch. Direct `git push`
commands still require approval; never use implicit refspecs. Wait for both the exact SHA's successful
push `CI / verify` run and Ready Git-triggered Vercel deployment before reporting a verified preview.
Do not use CLI deployments or moving aliases instead of Git pushes.

Publish only by fast-forwarding `main` to the verified `dev` SHA, after `git tidy` and renewed checks
following any rewrite. Main requires the `verify` check and disallows force pushes/deletion; no PR
is required. Obtain separate current-turn approvals for the main merge and main push. See
`docs/deployment.md` for bootstrap, promotion, rollback, and domain lifecycle.

Immediately before each production operation, obtain explicit approval in the current turn: production
deployment, pushing any ref that triggers production, promoting, aliasing, rollback, production
environment/domain/project writes, and merging to the production branch. Approved implementation
plans and earlier approvals do not waive these asks. This applies equally to CLI commands, scripts,
HTTP requests, MCP tools and Git, including indirect operations; never bypass an ask through another
transport. Codex and OpenCode must follow this operational instruction too; they do not consume Pi's
JSON rules.

The deterministic Pi/Claude rules also ask on Vercel env/project/domains/api command families
(including reads) and Vercel MCP tools. Domain provisioning, infrastructure, and protection changes
are deliberate operations, not implicit permission from preview-push authorization. String rules and
classifier guidance are not an OS sandbox or a guarantee about arbitrary script/API semantics.
Feature-branch hosts need no action: `npm run build` runs `scripts/preview-domain.ts --build` (Preview only,
using `PREVIEW_DOMAIN_TOKEN`, never failing the build); `npm run preview:domain` is only the manual add/remove.
Say which preview/publication path you took and why when reporting the change.

Previews use only `BLOG_PREVIEW_REDIS_REST_URL/TOKEN`, pointing to an isolated, sanitized snapshot.
Branch-scoped last-good caches expire after seven days; base totals are snapshot reads. Never copy
`strava:auth` or grant preview deployments production Redis/Strava credentials. Runtime Strava
webhook/reconcile/token-refresh/write paths require `VERCEL_ENV=production`; ordinary local authoring
scripts remain independent. Snapshot refresh is explicit via `npm run preview:seed`, never a build step.

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
  per-activity detail fetch — unchanged ids cost **zero** detail calls. The summary can't see description
  edits, photo swaps or caption edits, so activities from the **last 30 days** (`-- --recent-days <n>`,
  0 = off) are always rechecked via detail + photos; the detail-level `sourceHash` (description, gear,
  photo ids + captions) decides whether anything is rewritten. An older edit of that kind needs
  `-- --only <id>`. Each rewrite also deletes that activity's stale `photo-*` files (removed/replaced on
  Strava) but never hand imports listed in `data/adventures/local-photos/`. Flags: `-- --only <id[,id]>` syncs just
  those ids (O(1) — what `adventure:new` uses), `-- --force` re-fetches all, `-- --reindex` rebuilds the
  index from full history, `-- --retry-enrichment` heals missing weather/geocode without a detail call.
  Pre-schema snapshots get `summaryHash`/`workoutType` backfilled from the crawl (no detail call). It
  also refreshes the gitignored index + totals.
- **Derived vs editorial (companion frontmatter):** the pipeline derives everything unambiguous from
  the snapshot — `sport`, `title`, `date`, `peakClass`, facets, lap counts, and **`race`** (from Strava
  `workout_type`: Run 1 / Ride 11); `adventure:new` auto-attaches `group`/`laps` by GPS trailhead
  (`scripts/route-match.ts`). Frontmatter carries only editorial deltas (`type`, `tags`,
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
  `webhook:delete` manage the Strava push subscription (one per app). `npm run adventure:match`
  discovers repeat-route activities by GPS trailhead (dry-run by default, `-- --write` to scaffold
  the hidden count-only companions); `npm run adventure:migrate` is the one-shot taxonomy migration.
- **Discovery is scripted first, MCP second:** `npm run adventure:find` queries the local index
  (`data/adventures/all-activities.json`) with `--after`/`--before`, `--sport`, `--min-distance` (mi),
  `--min-gain` / `--min-high` (ft), `--with-photos`, `--unpublished` (excludes ids already on the
  site), `--json`. It needs **no MCP, no credentials, and no network**. The index is gitignored, so a
  fresh checkout must run `npm run sync:index` once (or `adventure:find -- --refresh`); the command
  says so when it's missing and warns when it's >7 days stale. The index carries `elevHighMeters` and
  `totalPhotoCount` precisely because summit height and photo count are what decide whether an
  activity is worth publishing.
- **Strava MCP** — an **optional accelerator** for fuzzy/interactive lookup, never a prerequisite:
  every authoring step (scaffold, sync, validate, build, ship) hits the Strava REST API directly with
  `.env.local`. Note the gateway truncates responses at ~27KB regardless of `per_page`, cutting the
  JSON mid-object, so a large listing needs date-windowed calls — `adventure:find` avoids the problem
  entirely. (`strava` server — **local** scope in `~/.claude.json`, i.e. private to this project,
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
  - `@blog/hardcover` (+ `/types`) — Hardcover GraphQL client (reading list)
  - `@blog/obsidian-md` — Obsidian markdown preprocessor
  - `@blog/inoreader` — Inoreader RSS client (blogroll)
  - `@blog/strava` (+ `/types`) — Strava API client, pure transforms, activity classification, and
    lifetime/yearly totals. `/types` is the client-safe type-only entrypoint the site imports.
- **ISR, not static export**: The site no longer uses `output: 'export'`. Most pages are statically generated at build time. Pages with external data (blogroll, reading, about) use ISR with `revalidate = 3600`. `/projects/[slug]` is server-rendered on demand to keep the Vercel cache small. The `generateStaticParams()` requirement still applies for dynamic SSG routes.
- **Live external data + last-good resilience**: The four live integrations (GitHub `/projects`, Hardcover `/reading` + `/about`, Inoreader `/blogroll` + `/blogroll.xml`, Strava `/adventures`) all render via ISR (`revalidate = 3600`), so an upstream API is hit at most ~once/hr/page regardless of traffic — **never make these routes `force-dynamic`** or every request hits the upstream. Resilience is consistent but per-integration, not a shared framework: the one shared piece is `lib/last-good.ts` `readThrough(key, fetcher)`, an Upstash-backed read-through cache that serves the last successful payload when the fetcher throws (and is a no-op pass-through with no Redis env). Because packages can't import `lib/`, the package exposes a throwing `*OrThrow` variant and the **app-layer** page wraps it in `readThrough` (a returned `[]` is treated as success — failure must throw). **Strava is the exception to the `*OrThrow` + app-layer rule**: its source is already in `lib/`, so `lib/strava-store.ts` wraps its own throwing read in `readThrough` rather than exposing an `*OrThrow` for the page — and one `cache()` then covers both totals readers, so a render costs one Redis read. Its coverage is genuinely narrower than the others': the source AND the last-good copy are the same Redis, so it survives an evicted/corrupt `strava:totals` or a transient failure, but **not** a full Upstash outage. That case is handled in the page instead — `/adventures` omits the lifetime-stats block when the totals are empty rather than rendering "0 mi all-time". GitHub/Hardcover/Inoreader are poll-only (no webhooks); only Strava pushes. Hardcover's token expires annually (Jan 1, manual rotation — watch for `[hardcover] AUTH FAILURE`). Inoreader feed identity is env-config (`INOREADER_USER_ID` / `INOREADER_PUBLIC_TAG` / `INOREADER_FEED_ITEM_COUNT`), as is the list of feed sources hidden from the blogroll (`INOREADER_SOURCE_BLOCKLIST`, default `reddit`, applied to items and subscriptions alike).
- **The Inoreader integration is credential-free and stays that way**: everything comes from the public tag RSS stream, at two depths. The article list uses `INOREADER_FEED_ITEM_COUNT` (~100); the feed list behind the `/blogroll` sidebar and `/blogroll.opml` crawls the same stream at `FEED_CRAWL_COUNT` (1000, ~9MB, cached hourly like everything else) and collapses it per source. **1000 items is Inoreader's hard ceiling** — `n` above it is ignored and there is no pagination (`ot`/`c`/`r` do nothing on a public stream), so the feed list covers ~10 weeks of history and cannot see a subscribed feed that published nothing in that window. Enumerating silent feeds would need the OAuth `subscription/list` endpoint (Pro-plan, Zone 1, 100 req/day) — deliberately not used.
- **Native marimo articles**: `marimo-blog` lives independently in `~/Projects/marimo-blog` and is installed as an exact npm release, not edited under `node_modules`. The authoring metadata `content/{blog,projects}/<slug>.marimo.yaml` and compiled `<slug>.marimo.json` are a required pair; the compiler owns output sanitization and asset hashing. Run `npm run notebook:import -- --slug <slug> --html <executed-export.html>` deliberately, then `npm run notebook:check`. Site builds, CI and page renders never execute Python or notebooks. For source editing, load `marimo-pair` and `marimo-style`; never edit notebook `.py` by hand. Reviewed script output needs an explicit sandbox policy; never render its scripts in the parent page.
- **Concepts registry**: Components in `/components/concepts/index.ts` use `next/dynamic` with `ssr: false` because they rely on browser APIs (canvas, window). Don't switch to regular imports or the build breaks.
- **Custom Tailwind breakpoints**: `md-toc` and `code-80` are project-specific breakpoints defined in `globals.css`, not standard Tailwind. Don't remove them — the TOC responsive layout depends on them.
- **Syntax highlighting themes**: Dark uses VS Code Dark+ colors, light uses Solarized Light. Both are defined as CSS custom properties in `globals.css`. Don't add highlight.js theme CSS files — the theming is manual.
- **Per-page metadata titles**: `app/layout.tsx` sets a `'%s — Data Spencer'` title template. Per-page `metadata.title` exports just provide the page name (`'Blog'`, `'Projects'`, etc.); the template fills in the suffix.
- **Content parser coupling**: `lib/content.ts` still handles blog, projects, and concepts with shared parsing logic. Content type differences (concepts have `component`, projects have `externalUrl`) are handled in the same functions — don't split into separate parsers without understanding the shared frontmatter pipeline. Reading-time math goes through one helper (`calculateReadingTime`) — reuse it, don't recompute.
- **Objectives**: the public catalog behind `/adventures/objectives/<page>` is `content/objectives/<slug>.md`, validated by `lib/objective-schema.ts` (page, sections, stats, coordinates, `completed_by: <adventure slug>`). Done items take any missing stats and their map point from that report. The repo is public: priorities, dates and plans live in the Obsidian note `Objectives Plan.md`, never here. Detail pages at `/adventures/objectives/<page>/<slug>`. To-do route tracks are authored, not fetched at build: frontmatter `route` (osm relation / brouter via points / line waypoints) is turned into `data/objectives/routes/<slug>.json` by `npm run objectives:build` (OSM API, BRouter, Open-Meteo then OpenTopoData; cached in `node_modules/.cache/objectives`; rebuilds only when the spec hash changes). `data/objectives/wikidata.json` holds the Wikidata-derived links; rerun the script after adding or changing a `wikidata` QID.
- **Project cards**: `content/projects/<slug>.md` frontmatter drives `/projects`. Top-level cards need a registered `kind` (`lib/project-kinds.ts`); `featured: true` needs `featuredOrder`, `image` (a 1200x630 file in `public/project-images/`) and a body. A card opens its detail view when the file has a body, is a `collection`, or has no external link; from `/projects` that view is a modal (`app/projects/@modal/(.)[slug]`, an intercepting route over the same `components/ProjectDetail.tsx` the full page renders). Renaming or deleting a slug needs a redirect in `next.config.mjs`, an entry in `RETIRED_SLUGS` when it had commits, and updates to `REPO_TO_SLUG` and `lib/project-names.ts`.
- **Lint rule downgrades**: React Compiler-style rules from `react-hooks` v6 (`refs`, `immutability`, `static-components`, `set-state-in-*`, `purity`) are downgraded to warnings in `eslint.config.mjs` because the existing canvas/concept components trip them harmlessly. `rules-of-hooks` is still an error.

## Polypane MCP

When connected to Polypane via Chrome DevTools MCP:
- Multiple panes showing the same URL are different **viewports** in a single tab, not separate pages.
- Get pane names via `window.__polypane.title`.
- Apply snapshots/scripts to all panes in parallel for multi-viewport testing.
- Filter out internal URLs starting with `polypane://` or containing `/resources/app.asar/`.

## Testing

- All tests: `npm run test`
- One workspace package: `npm -w @blog/hardcover run test` (or `-w @blog/inoreader`, etc.)
- Single test file: `npx vitest run lib/__tests__/marimo-content.test.ts`
- Compiled article ownership/asset/config checks: `npm run notebook:check`.
- React component tests are intentionally not wired up yet (vitest is `environment: 'node'`, no jsdom).
