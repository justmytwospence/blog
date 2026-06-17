# @blog/hardcover

Thin GraphQL client for [Hardcover](https://hardcover.app)'s reading-list API. Used by the blog's `/about` and `/reading` pages.

## Install

```ts
import {
  getReadingListData, getCurrentlyReading,           // non-throwing (return [] on failure)
  getReadingListDataOrThrow, getCurrentlyReadingOrThrow, // throwing (for last-good wrapping)
  HardcoverAuthError,
} from '@blog/hardcover';
import type { UserBook, HardcoverBook, ReadingListData } from '@blog/hardcover/types';
```

## Environment

| Var | Required | Purpose |
|---|---|---|
| `HARDCOVER_API_TOKEN` | yes | Bearer token from your Hardcover account. Server-side only — no `NEXT_PUBLIC_` prefix. |
| `HARDCOVER_BLACKLIST` | no | Comma-separated book slugs to hide from the public list. |

If `HARDCOVER_API_TOKEN` is missing, the non-throwing functions return an empty list. The build never fails. A 10s timeout bounds each request.

## Token rotation (annual, manual)

Hardcover bearer tokens **expire every Jan 1** and there is **no refresh/rotation mechanism** (no OAuth refresh flow) — the token must be **manually regenerated** from your Hardcover account once a year. An expired token surfaces as a loud `[hardcover] AUTH FAILURE …` console error and a thrown `HardcoverAuthError`; the app pages serve the last-good snapshot (via `lib/last-good.ts`) until the token is rotated. There is no automatic recovery — watch for that log line each January.

## API

```ts
getReadingListData(): Promise<ReadingListData>          // 3 parallel GraphQL requests; [] on failure
getCurrentlyReading(limit?: number): Promise<UserBook[]> // currently-reading only; [] on failure

getReadingListDataOrThrow(): Promise<ReadingListData>    // throws if ANY of the 3 fetches fails
getCurrentlyReadingOrThrow(limit?: number): Promise<UserBook[]> // throws on failure
```

The `*OrThrow` variants exist so the app layer can wrap them in the last-good cache: a returned `[]`
looks like success to a read-through cache, so failure must be signalled by throwing. Auth failures
throw `HardcoverAuthError`; transient failures throw a plain `Error`. The non-throwing variants catch
everything and surface `[hardcover] ...` console errors, returning `[]`.

> npm-workspaces note: this package never imports from the app (`lib/`/`@/`). The last-good (Upstash)
> wrapping lives at the app layer (`app/reading`, `app/about`), so the package stays pure and testable.

## Tests

```bash
npm -w @blog/hardcover run test
```

Covers the happy path, transformation, blacklist filter, parallel fetches, every failure mode of the
non-throwing API (no token, HTTP error, GraphQL error, network throw), and the throwing variants
(reject with `HardcoverAuthError` on 401 / GraphQL-auth / missing token; plain `Error` on 5xx/network).
