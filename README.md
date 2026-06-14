# Spencer's Blog & Portfolio

A personal data science portfolio and blog built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS v4**. Hosted on Vercel as an ISR site.

The headline feature is rendering Jupyter notebooks (`.ipynb`) directly as interactive project pages with Quarto-compatible metadata.

## Getting Started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Production build (.next/)
npm run lint         # ESLint via eslint-config-next
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, and build on every push and pull request.

## Architecture

### Rendering model

Most pages are statically prerendered at build time. Pages that pull live external data — `/blogroll`, `/blogroll.xml`, `/reading`, `/about` — use **ISR** with `revalidate = 3600` so the build never depends on flaky upstreams. `/projects/[slug]` is server-rendered on demand to keep the Vercel cache small.

### npm workspaces

Domain-specific code lives in standalone workspace packages so each can be tested and reused independently:

| Package | Purpose |
|---|---|
| `@blog/notebook-parser` | Jupyter notebook parsing, validation, Quarto metadata extraction, output utilities (the "Quarto clone"). |
| `@blog/hardcover` | Hardcover GraphQL client for the reading list. |
| `@blog/obsidian-md` | Obsidian-flavored markdown preprocessor (wikilinks, image embeds, highlights). |
| `@blog/inoreader` | Inoreader RSS client for the blogroll. |

Next.js `transpilePackages` compiles the raw TypeScript in each. Always import from the package name (`@blog/notebook-parser`), never from internal paths.

### Content (`/content`)

Four content types share a parser in `lib/content.ts`:

- **Blog posts** (`/content/blog/*.md`) — markdown with YAML frontmatter (`title`, `date`, `categories`, `description`, `featured`, optional `bluesky`).
- **Projects** (`/content/projects/*`) — markdown, notebook (`.ipynb` with Quarto frontmatter in the first cell), webapp config (`.json`), or external link (markdown with `externalUrl`).
- **Concepts** (`/content/concepts/*.md`) — interactive explainers backed by a React component registered in `components/concepts/index.ts` (dynamic import with `ssr: false` because they use canvas/window).
- **Pages** — currently only `/about` and `/`, hardcoded TSX.

### Comments (Bluesky)

Blog posts can render a comment section sourced from a Bluesky post's replies — no
database, no spam tooling (moderation is inherited from Bluesky). Workflow:

1. Publish a Bluesky post linking to the article.
2. Add its URL to the post frontmatter: `bluesky: "https://bsky.app/profile/<handle>/post/<rkey>"` (an `at://…` URI also works).

**Reading** (`components/BlueskyComments.tsx`, a client island): resolves the reference
to an AT-URI and fetches the reply thread live from the public AppView
(`public.api.bsky.app`, unauthenticated) on each visit, so comments stay current
without rebuilding. Renders nested threads (depth-capped, collapsible), rich-text
facets (links/mentions/hashtags via UTF-8 byte offsets), image embeds, a sort toggle,
and a "Reply on Bluesky" CTA. The AT Protocol read helpers and their unit tests live
in `lib/bluesky.ts` / `lib/bluesky.test.ts`.

**Writing** (`components/BlueskyComposer.tsx`): an in-page composer lets visitors sign
in with their own Bluesky account and post a reply without leaving the article — the
comment lands as a real threaded reply on Bluesky, authored by them. Auth is
browser-only AT Protocol OAuth (PKCE + DPoP, no backend secrets) via
`@atproto/oauth-client-browser`; the reply is created with `@atproto/api` (`RichText`
facet detection + a `reply` strong-ref to the anchor post). Because these packages
touch `window`/`indexedDB`/`crypto`, the composer (and the OAuth callback) are loaded
through `dynamic(..., { ssr: false })` so they never enter the server bundle.

OAuth setup:

- **Client metadata** is served at `/client-metadata.json` (`app/client-metadata.json/route.ts`,
  `force-static`). Its `client_id` must equal that URL, derived from
  `NEXT_PUBLIC_SITE_ORIGIN` (defaults to `https://spencerboucher.com`). It requests
  scope `atproto transition:generic` (read + write) and declares the redirect URI.
- **Callback**: `/bluesky/callback` (`app/bluesky/callback/page.tsx`) completes the
  redirect and returns the visitor to the post they were reading (carried in the OAuth
  `state`). Shared client logic is in `lib/blueskyClient.ts` (browser-only) and
  `lib/blueskyConfig.ts` (atproto-free constants, safe for the server route).
- **Local dev**: on `localhost`/`127.0.0.1` the client uses a synthesized "loopback"
  `client_id`, so no hosted metadata file is needed. Dev sessions expire quickly (~1 day)
  and there's no silent sign-in — both are normal for loopback clients. Note: Vercel
  *preview* deployments have a different origin than production, so OAuth sign-in only
  works on `localhost` and the production domain, not on `*.vercel.app` previews.

### Routes

| Route | Notes |
|---|---|
| `/` | Featured-content carousels |
| `/blog`, `/blog/[slug]`, `/blog/tags/[tag]` | Blog listing, post, and tag filter |
| `/projects`, `/projects/[slug]` | Project grid and detail (dynamic) |
| `/concepts`, `/concepts/[slug]` | Interactive concept pages |
| `/blogroll` (+ `/blogroll.xml`) | Curated RSS reading list (ISR, OPML-style RSS) |
| `/reading` | Hardcover reading list (ISR) |
| `/about` | About page (ISR — pulls "currently reading") |
| `/feed.xml`, `/atom.xml` | RSS / Atom for blog posts |

### Styling

- **Tailwind v4** with `@tailwindcss/typography` for prose.
- **Dark mode** via `next-themes` (class strategy). Dark = VS Code Dark+, light = Solarized Light. Both are CSS custom properties in `app/globals.css` — don't add highlight.js theme files.
- **Fonts**: Inter (UI) and Merriweather (prose).
- **Custom breakpoints**: `md-toc` and `code-80` are project-specific (defined in `globals.css`) for the responsive TOC.

### Conventions

- Path alias `@/*` → project root.
- Server components by default; `'use client'` only where interactivity is needed.
- Three-layer error boundaries in notebook rendering: notebook → cell → output.
- Notebook HTML output is sanitized via `isomorphic-dompurify`.
- Per-page `metadata.title` exports automatically combine with the `'%s — Data Spencer'` template in `app/layout.tsx`.

## Testing

```bash
npm run test                          # all tests
npm -w @blog/notebook-parser run test # one workspace
npx vitest run path/to/file.test.ts   # single file
```

Vitest runs in `node` environment (no React/jsdom). React component tests are intentionally not wired up yet.
