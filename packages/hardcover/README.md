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

GROUP_LIMIT: number                                      // books per fiction/non-fiction group (5)
```

The `*OrThrow` variants exist so the app layer can wrap them in the last-good cache: a returned `[]`
looks like success to a read-through cache, so failure must be signalled by throwing. Auth failures
throw `HardcoverAuthError`; transient failures throw a plain `Error`. The non-throwing variants catch
everything and surface `[hardcover] ...` console errors, returning `[]`.

> npm-workspaces note: this package never imports from the app (`lib/`/`@/`). The last-good (Upstash)
> wrapping lives at the app layer (`app/reading`, `app/about`), so the package stays pure and testable.

## Shelf size, ordering, and "see all" links

`/reading` splits every shelf into a Fiction grid and a Non-Fiction grid, so the unit that governs
how long a row looks is the **group**, not the shelf. Each shelf is trimmed by one of three policies
(`Trim` in `src/index.ts`):

| Shelf | Policy | Result |
|---|---|---|
| Currently Reading | `all` | the whole shelf, uncapped — it is a complete state, not a sample, and truncating it would misreport how many books are in flight |
| Recently Read | `perGroup` | `GROUP_LIMIT` (5) fiction **and** 5 non-fiction |
| To Be Read | `perGroup` | same |
| `getCurrentlyReading(n)` (the /about widget) | `count` | exactly `n`, class-blind |

- **Classification happens locally, so the query has to over-read.** Hardcover cannot filter on
  fiction-ness (it is derived from `literary_type_id` + tags), so `perGroup` pulls a
  `CLASSIFY_WINDOW` of 40 and sorts it out here. 40 is sized off the real shelves: "Read" runs about
  9:1 fiction, putting the 5th non-fiction book ~22 deep. A shelf lopsided past the window renders a
  short row rather than a wrong one.
- **Per-shelf ordering.** "Recently Read" sorts by `last_read_date` (when the book was *finished*),
  not `date_added`. Books are routinely shelved months before they're finished, so `date_added`
  silently omits recent finishes — it was hiding a book finished a fortnight ago behind ten older
  ones. The other two shelves genuinely are "most recently added".
- **Links to the rest.** `ReadingListData.shelves[key]` carries the full shelf `total` (from
  `user_books_aggregate`, in the same request — no extra round trip) and a `url` to the public
  hardcover.app shelf. The URL is emitted **only when `account_privacy_setting_id` is 1 (Public)**;
  on a Followers-only or Private account it is null and the UI drops the link rather than pointing a
  logged-out visitor at a 404. The link is hidden when the shelf holds no more than is already shown,
  which is why uncapped Currently Reading normally has none.

> Note: those links lead to Hardcover's own shelf pages, which show **every** book — including the
> ones `HARDCOVER_BLACKLIST` / `KEYWORD_BLOCKLIST` hide here. The blocklist keeps books off this
> site; it cannot hide them on a public Hardcover profile.

### Blocklist matching

`KEYWORD_BLOCKLIST` matches **stems against title *and* slug**, and both details are load-bearing —
rendering more books per shelf exposed a book to each:

- `suicide` as a whole word let *The Suicidal Mind* through; the entry is `suicid`.
- Hardcover's `title` is sometimes a truncated form that drops the telling half: *The Savage God: A
  Study of Suicide* is stored as title `"The savage god"`. Its **slug** keeps the full title
  (`the-savage-god-a-study-of-suicide`), so the slug is matched too.

Descriptions are deliberately **not** scanned — plenty of unrelated books mention a blocked topic in
passing, and hiding those would be a rule nobody asked for.

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
