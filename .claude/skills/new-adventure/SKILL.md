---
name: new-adventure
description: >-
  Add a new outdoor adventure (a Strava activity) to the site's Adventures library: discover the
  activity, classify it (type / tags / title / flags), scaffold its companion file, sync its Strava
  data, preview, and deploy. Use when the user says they did a new run / climb / ski / ride /
  scramble and wants it on the site, asks to sync Strava, or wants to whitelist / add a new activity
  to the adventures library.
---

# Add a new adventure

This skill turns a freshly-completed Strava activity into a published trip report. The mechanical
work lives in npm scripts — your job is the **discovery and the editorial classification**, with the
human in the loop. Call the scripts; never reimplement them.

## Prerequisites

The adventures pipeline and credentials only exist on a checkout that has them:

- You must be on `main` (or a feature branch off `main`) — the `audit-fixes` branch does NOT have the
  pipeline. If you're not, create one: `git worktree add .claude/worktrees/adv-<name> main`.
- `.env.local` with `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` / `STRAVA_REFRESH_TOKEN` must be in
  that checkout's root (it's gitignored, so copy it from the primary checkout if missing).
- Run `npm install` if `node_modules` / `tsx` aren't present.

## Steps

### 1. Discover the activity

Find the activity the user means. Prefer the Strava MCP if connected:
`mcp__strava__strava_list_activities` (filter to the day they mention). Otherwise, diff the synced
index against existing companions:

```bash
# Activity ids already whitelisted:
grep -hoE 'strava_id[s]?:.*' content/adventures/*.md
# Recent activities live in data/adventures/all-activities.json (id, name, date, sport, distance).
```

Confirm the exact activity (name + date + distance) with the user before proceeding. Capture its
**Strava id**.

### 2. Classify it (human-in-the-loop)

Propose frontmatter from the activity's name, sport, distance, elevation, and location, then **ask the
user to confirm or adjust**. The fields and their allowed values are defined in `lib/adventure-schema.ts`
(the single source of truth) — read it rather than guessing:

- `type`: `peak | scramble | traverse | couloir | thru-hike | mountaineering` (omit if none fit)
- `sport`: override only if Strava's sport is wrong (e.g. `Scramble`, `Hike`)
- `tags`: short category tags (e.g. `[colorado, 14er]`)
- `title`: only if the Strava activity name needs cleanup
- `race: true` / `duathlon: true` flags where applicable
- `difficulty`: `moderate | hard | epic`
- `group`: set when it's a repeat of an existing route (reuse that route's group key so the cards
  collapse into one) — check existing companions for the key

Do NOT invent values outside the schema; the validator (step 5) will reject them.

### 3. Scaffold the companion

```bash
npm run adventure:new -- <stravaId> \
  --type <type> --tags <a,b> --title "<title>" [--race] [--sport <Sport>] [--group <key>]
```

This fetches the activity summary and writes `content/adventures/<slug>.md`. Open it and refine the
frontmatter if needed. (Omitted fields are written as commented hints to fill in.)

### 4. Sync the activity's data

```bash
npm run sync:strava
```

Idempotent: it fetches maps / photos / streams for the newly-whitelisted activity, refreshes the
all-activity index and lifetime/yearly totals, and persists any rotated refresh token. Review the
resulting `git status` — expect new files under `data/adventures/` + `public/adventures/<id>/`.

### 5. Validate + preview

```bash
npm run adventure:validate          # schema lint (also runs in CI)
npm run build                       # or: npm run dev, then open /adventures/<slug>
```

Screenshot or open `/adventures/<slug>` to confirm the map, stats, and photos render. Also check the
library card and that any `group` collapsed correctly.

### 6. Ship it

Commit the companion + synced data, then deploy. Default to a PR for review (CI runs lint / typecheck
/ test / validate / build), then merge to `main` — pushing to `main` triggers the Vercel production
deploy. Confirm the new adventure is live on `spencerboucher.com/adventures/<slug>`.

## Notes

- Reading the schema (`lib/adventure-schema.ts`) and a couple of existing companions in
  `content/adventures/` is the fastest way to match conventions.
- `sync:strava` only fetches **whitelisted** ids (those referenced by a companion `.md`). A new
  activity does nothing until its companion exists — that's why step 3 precedes step 4.
- For a multi-leg / multi-day outing, use `strava_ids: [id1, id2]` and the `days:` structure by hand
  (see an existing multi-day companion); the scaffold script handles the single-id case.
