# @blog/inoreader

Fetches and normalizes a public Inoreader RSS feed into typed `BlogrollItem`s. Powers the blog's `/blogroll` page and `/blogroll.xml` OPML feed.

## Install

```ts
import { getBlogrollItems } from '@blog/inoreader';
import type { BlogrollItem } from '@blog/inoreader';

const items = await getBlogrollItems();
```

## What it does

- Fetches RSS XML from a hard-coded Inoreader feed URL.
- Parses it with `fast-xml-parser`.
- For each `<item>`, returns:
  - `title`, `url`, `publishedDate`
  - `author` (from `dc:creator`)
  - `sourceName` / `sourceUrl` (from `<source>`)
  - `summary` — HTML-stripped, truncated to 200 chars
  - `categories` — minus the `Archive` tag (used as the feed marker)
  - `readingTime` — estimated from word count, or `null` for short URL-stub items

On any failure (network, non-200, parse error) the function returns `[]` and logs `[inoreader] ...` so the build never breaks.

## Notes

- The package fetches a single Inoreader public tag (`PUBLIC_TAG` constant in `src/index.ts`, currently `Archive`) under a hard-coded user ID. Items must be tagged with `PUBLIC_TAG` in Inoreader, and the tag must be marked **Public** in Inoreader's settings — system states like "Starred" cannot be exposed without OAuth, so the workflow is "tag-to-share, not star-to-share".
- The marker tag is stripped from each item's `categories` so it doesn't show up as a UI filter chip.
- Reading time is computed from the description body since Inoreader doesn't provide `<content:encoded>`. A 30-word floor skips HN-style URL-only stubs.
