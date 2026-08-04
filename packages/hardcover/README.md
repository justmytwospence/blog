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

SHELF_LIMIT: number                                      // books rendered per shelf (5)
```

The `*OrThrow` variants exist so the app layer can wrap them in the last-good cache: a returned `[]`
looks like success to a read-through cache, so failure must be signalled by throwing. Auth failures
throw `HardcoverAuthError`; transient failures throw a plain `Error`. The non-throwing variants catch
everything and surface `[hardcover] ...` console errors, returning `[]`.

> npm-workspaces note: this package never imports from the app (`lib/`/`@/`). The last-good (Upstash)
> wrapping lives at the app layer (`app/reading`, `app/about`), so the package stays pure and testable.

## Shelf size, ordering, and "see all" links

Each of the three shelves renders exactly `SHELF_LIMIT` (5) books, so no section looks arbitrarily
longer than another. Three things make that work:

- **Over-fetch, then trim.** The slug/title blocklist filters *after* the query returns, so asking
  for exactly 5 would render a short row whenever a blocked book landed in the window. The query asks
  for `SHELF_LIMIT + 10` and slices back to 5 once filtering is done.
- **Per-shelf ordering.** "Recently Read" sorts by `last_read_date` (when the book was *finished*),
  not `date_added`. Books are routinely shelved months before they're finished, so `date_added`
  silently omits recent finishes — it was hiding a book finished a fortnight ago behind ten older
  ones. The other two shelves genuinely are "most recently added".
- **Links to the rest.** `ReadingListData.shelves[key]` carries the full shelf `total` (from
  `user_books_aggregate`, in the same request — no extra round trip) and a `url` to the public
  hardcover.app shelf. The URL is emitted **only when `account_privacy_setting_id` is 1 (Public)**;
  on a Followers-only or Private account it is null and the UI drops the link rather than pointing a
  logged-out visitor at a 404.

> Note: those links lead to Hardcover's own shelf pages, which show **every** book — including the
> ones `HARDCOVER_BLACKLIST` / `TITLE_BLOCKLIST` hide here. The blocklist keeps books off this site;
> it cannot hide them on a public Hardcover profile.

## Fiction / non-fiction (`HardcoverBook.isFiction`)

`/reading` splits each shelf into Fiction and Non-Fiction, but Hardcover has no single reliable field
for it, so `src/classify.ts` walks a ladder of signals and stops at the first one that answers:

1. **`literary_type_id`** — Hardcover's own curated field (`1` fiction, `2` non-fiction). Trustworthy,
   but null for a large share of books.
2. **Crowd genre tags** (`cached_tags`, the `Genre` + `Tag` buckets) as a weighted vote: an explicit
   `Fiction`/`Nonfiction` tag (3) beats a compound like `Science Fiction` (2) beats an implying genre
   like `Memoir` (1). Tag *counts* are deliberately ignored — bulk BISAC imports carry counts in the
   thousands (`Body, Mind & Spirit`) and would outvote every real reader tag. The `Mood` bucket is
   skipped: it describes tone, not form.
3. **`book_category_id`** — only the decisive ones (Short Story, Graphic Novel, Research Paper …);
   `Book`, `Collection` and `Poetry` say nothing.
4. **Subtitle shape** — a last-resort tiebreak. An explanatory subtitle is a non-fiction convention;
   fiction subtitles are rare and usually genre markers (`A Novel`). Falls back to the title's
   post-colon half when the `subtitle` field is null.

Only a book that trips none of these hits the default (fiction). The earlier implementation looked at
`taggings` filtered to the literal strings `Fiction`/`Nonfiction` and defaulted to fiction whenever
neither was present — which was most of the shelf, so non-fiction routinely surfaced under "Fiction".

## Tests

```bash
npm -w @blog/hardcover run test
```

Covers the happy path, transformation, blacklist filter, parallel fetches, every failure mode of the
non-throwing API (no token, HTTP error, GraphQL error, network throw), and the throwing variants
(reject with `HardcoverAuthError` on 401 / GraphQL-auth / missing token; plain `Error` on 5xx/network).

`__tests__/classify.test.ts` covers each rung of the fiction ladder plus a regression table of real
shelf entries the old tag-only classifier got wrong.
