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

- The feed URL is currently hard-coded (Spencer's reading list). If you fork this, change `FEED_URL` in `src/index.ts`.
- Reading time is computed from the description body, since Inoreader doesn't provide `<content:encoded>`. The 30-word floor skips HN-style URL-only stubs.
