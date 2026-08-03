# @blog/inoreader

Fetches and normalizes a public Inoreader RSS feed. Two views of the same stream, both credential-free:

| | What | Depth | Powers |
|---|---|---|---|
| **Items** | individual articles | `INOREADER_FEED_ITEM_COUNT` (100) | `/blogroll` article list, `/blogroll.xml` |
| **Feeds** | one entry per source | `FEED_CRAWL_COUNT` (1000, the API ceiling) | `/blogroll` sidebar, `/blogroll.opml` |

## Install

```ts
import { getBlogrollItems, getBlogrollItemsOrThrow } from '@blog/inoreader';
import { getBlogrollFeeds, getBlogrollFeedsOrThrow, buildOpml } from '@blog/inoreader';
import type { BlogrollItem, BlogrollFeed } from '@blog/inoreader';

const items = await getBlogrollItems();          // [] on failure (build-safe default)
const itemsOrThrow = await getBlogrollItemsOrThrow(); // throws on HTTP/network failure

const feeds = await getBlogrollFeedsOrThrow();   // every feed the stream has seen publish
const opml = buildOpml(feeds, { title: 'Blogroll', ownerName: 'Spencer' });
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
| `INOREADER_FEED_ITEM_COUNT` | `100` | How many items the stream returns (`n`) for the ARTICLE list. The feed crawl always asks for 1000. |
| `INOREADER_SOURCE_BLOCKLIST` | `reddit` | Comma-separated sources to hide, applied to items and feeds alike (full override, not an addition). Empty string disables it. |

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
- Drops blocked sources (default: Reddit). Matched case-insensitively against the `<source>` title
  and the host of `<source url>` — host, subdomain, or a single dot-label — so `reddit` catches
  `www.reddit.com` and a feed named `r/running`, but not a Hacker News post *about* Reddit.
- `deriveFeeds` collapses items into one `BlogrollFeed` per source domain, unioning their tags and
  counting their items; `buildOpml` serializes that to OPML 2.0 nested under those tags.

On any failure (network, non-200, parse error) the function returns `[]` and logs `[inoreader] ...` so the build never breaks.

## Notes

- The package fetches a single Inoreader public tag (`INOREADER_PUBLIC_TAG`, default `Archive`) under `INOREADER_USER_ID`. Items must be tagged with that tag in Inoreader, and the tag must be marked **Public** in Inoreader's settings — system states like "Starred" cannot be exposed without OAuth, so the workflow is "tag-to-share, not star-to-share".
- The marker tag is stripped from each item's `categories` so it doesn't show up as a UI filter chip.
- Reading time is computed from the description body since Inoreader doesn't provide `<content:encoded>`. A 30-word floor skips HN-style URL-only stubs.
- **The feed list's limit**: a public stream returns at most 1000 items (~10 weeks) and supports no pagination — `n` above 1000 is ignored, and `ot` / `c` / `r` are all no-ops. So the feed list covers every feed that published in that window, but cannot see a subscribed feed that has been silent longer. Full enumeration would require the OAuth `subscription/list` endpoint (Pro-plan, 100 req/day); the trade was made deliberately in favour of zero credentials.
- OPML emits the Inoreader `<source url>` as both `xmlUrl` and `htmlUrl`. Inoreader reports the feed's declared site link when it has one and the subscription URL otherwise, so that value is sometimes the site and sometimes the feed itself — importers that auto-discover handle both.
