# Spencer's Blog & Portfolio

A personal data science portfolio and blog built with Next.js 16, TypeScript, and Tailwind CSS v4. Statically exported. The key feature is rendering Jupyter notebooks (`.ipynb`) directly as interactive project pages with Quarto-compatible metadata support.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Static export to /out
npm run lint
npm run test
```

## Content System

All content lives in `/content`. Four types:

### Blog Posts (`/content/blog/*.md`)

Standard markdown with YAML frontmatter:

```yaml
title: "Post Title"
date: "2025-01-01"
categories: ["python", "ml"]
description: "Short description for cards and SEO"
featured: true  # Appears on homepage carousel
```

### Projects (`/content/projects/`)

Three formats supported — pick one per project:

- **Markdown** (`.md`): Same frontmatter as blog posts
- **Notebook** (`.ipynb`): Jupyter notebook with Quarto-style YAML frontmatter in the first raw/markdown cell
- **Webapp** (`.json`): Config file pointing to a standalone app (uses `externalUrl` field)

### Concepts (`/content/concepts/*.md`)

Interactive explainers. Each concept has:

1. A markdown file with frontmatter including a `component` field
2. A React component in `/components/concepts/` (must be `'use client'`, default export)

Register new components in `/components/concepts/index.ts` with a dynamic import.

### Pages (`/content/pages/*.md`)

Static pages like About.

## Architecture

### Notebook Rendering Pipeline

The standout feature of this site. The pipeline:

1. **Parse** (`lib/notebook/parser.ts`): Reads `.ipynb` JSON, normalizes cell sources
2. **Validate** (`lib/notebook/validator.ts`): Ensures valid notebook structure
3. **Extract metadata** (`lib/notebook/metadata.ts`): Pulls title/date/categories from Quarto-style YAML in the first cell
4. **Render** (`components/notebook/NotebookRenderer.tsx`): Orchestrates all cells with visibility controls and responsive TOC

Supported output types: text, HTML, images, Plotly charts, Jupyter widgets, error tracebacks.

Quarto cell options are respected: `echo`, `output`, `code-fold`, `fig-cap`, etc.

### App Routes

| Route | Purpose |
|-------|---------|
| `/` | Homepage with featured content carousels |
| `/blog` | Blog listing (timeline view) |
| `/blog/[slug]` | Blog post |
| `/blog/tags/[tag]` | Posts filtered by tag |
| `/projects` | Project listing (grid view) |
| `/projects/[slug]` | Project detail (markdown, notebook, webapp, or external link) |
| `/concepts` | Concepts listing (grid view) |
| `/concepts/[slug]` | Interactive concept page |
| `/about` | About page |
| `/feed.xml`, `/atom.xml` | RSS/Atom feeds |

All routes use `generateStaticParams()` for static generation.

### Styling

- **Tailwind CSS v4** with `@tailwindcss/typography` for prose
- **Dark mode** via `next-themes` (class strategy) — VS Code Dark+ for dark, Solarized Light for light
- **Fonts**: Inter (UI) and Merriweather (prose)
- **Custom breakpoints**: `md-toc` (640px) and `code-80` (80ch + sidebar width) for responsive TOC layout

### Key Patterns

- Path alias `@/*` maps to project root
- Server components by default; `'use client'` only where interactivity is needed
- Shared `CodeBlock` component for both notebook cells and blog markdown
- Three-layer error boundaries in notebook rendering (notebook → cell → output)
- `useMediaQuery` hook in `/lib/hooks.ts` for responsive behavior
