# @blog/inoreader

Fetches and normalizes a public Inoreader RSS feed into typed `BlogrollItem`s. Powers the blog's `/blogroll` page and `/blogroll.xml` OPML feed.

## Install

```ts
import { getBlogrollItems, getBlogrollItemsOrThrow } from '@blog/inoreader';
import type { BlogrollItem } from '@blog/inoreader';

const items = await getBlogrollItems();          // [] on failure (build-safe default)
const itemsOrThrow = await getBlogrollItemsOrThrow(); // throws on HTTP/network failure
```

`getBlogrollItemsOrThrow` exists so the app layer can wrap the call in the last-good cache
(`lib/last-good.ts`): a returned `[]` looks like success to a read-through cache, so a real outage
must be a throw. An empty-but-valid feed still returns `[]`. The package never imports from the app.

## Environment

All optional — defaults reproduce the current public "Archive" feed, so absent env = unchanged. Read
at request time, so an ISR revalidation picks up changes. Server-only (no `NEXT_PUBLIC_` prefix); the
public RSS feed needs no auth and consumes **zero API quota**.

| Var | Default | Purpose |
|---|---|---|
| `INOREADER_USER_ID` | `1003561864` | Inoreader numeric user id whose public tag stream is read. |
| `INOREADER_PUBLIC_TAG` | `Archive` | The tag marked **Public** in Inoreader (also stripped from filter chips). |
| `INOREADER_FEED_ITEM_COUNT` | `100` | How many items the stream returns (`n`). |

## What it does

- Fetches RSS XML from the Inoreader feed URL built from the env config above.
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

- The package fetches a single Inoreader public tag (`INOREADER_PUBLIC_TAG`, default `Archive`) under `INOREADER_USER_ID`. Items must be tagged with that tag in Inoreader, and the tag must be marked **Public** in Inoreader's settings — system states like "Starred" cannot be exposed without OAuth, so the workflow is "tag-to-share, not star-to-share".
- The marker tag is stripped from each item's `categories` so it doesn't show up as a UI filter chip.
- Reading time is computed from the description body since Inoreader doesn't provide `<content:encoded>`. A 30-word floor skips HN-style URL-only stubs.
