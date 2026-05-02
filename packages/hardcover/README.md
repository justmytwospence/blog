# @blog/hardcover

Thin GraphQL client for [Hardcover](https://hardcover.app)'s reading-list API. Used by the blog's `/about` and `/reading` pages.

## Install

```ts
import { getReadingListData, getCurrentlyReading } from '@blog/hardcover';
import type { UserBook, HardcoverBook, ReadingListData } from '@blog/hardcover/types';
```

## Environment

| Var | Required | Purpose |
|---|---|---|
| `HARDCOVER_API_TOKEN` | yes | Bearer token from your Hardcover account. Server-side only — no `NEXT_PUBLIC_` prefix. |
| `HARDCOVER_BLACKLIST` | no | Comma-separated book slugs to hide from the public list. |

If `HARDCOVER_API_TOKEN` is missing, every public function returns an empty list and logs a warning. The build never fails.

## API

```ts
getReadingListData(): Promise<ReadingListData>
// → { currentlyReading, wantToRead, recentlyRead, fetchedAt }
// Three GraphQL requests in parallel.

getCurrentlyReading(limit?: number): Promise<UserBook[]>
// → just the currently-reading list (default limit 5).
```

All errors (network, HTTP, GraphQL) are caught and surfaced as `[hardcover] ...` console errors, returning `[]` so callers don't have to.

## Tests

```bash
npm -w @blog/hardcover run test
```

8 tests covering the happy path, transformation, blacklist filter, parallel fetches, and every failure mode (no token, HTTP error, GraphQL error, network throw).
