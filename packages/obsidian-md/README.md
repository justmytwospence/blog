# @blog/obsidian-md

Tiny preprocessor that turns Obsidian-flavored markdown into standard CommonMark before downstream rendering. Used by the blog's content pipeline so notes drafted in Obsidian render correctly.

## Install

```ts
import { preprocessObsidian } from '@blog/obsidian-md';

const standardMarkdown = preprocessObsidian(obsidianMarkdown, postSlug);
```

The slug is used to resolve image paths.

## Transforms

| Obsidian | Becomes |
|---|---|
| `![[photo.png]]` | `![photo.png](/blog/images/{slug}/photo.png)` |
| `![[photo.png\|alt]]` | `![alt](/blog/images/{slug}/photo.png)` |
| `[[page]]` | `**page**` |
| `[[page\|display]]` | `**display**` |
| `==text==` | `<mark>text</mark>` |

Code fences (` ``` ` and `~~~`) and inline code (`` ` ``) are protected — transforms don't run inside them.

Wiki links currently render as bold text. To turn them into actual cross-links, resolve targets to `/blog/{slug}` URLs in `transformWikiLinks`.

## Tests

```bash
npm -w @blog/obsidian-md run test
```

16 tests covering each transform, code-fence protection, and edge cases (empty input, multiple embeds, etc.).
