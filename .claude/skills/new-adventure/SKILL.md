---
name: new-adventure
description: >-
  Add a new outdoor adventure (a Strava activity) to the site's Adventures library: discover the
  activity via the Strava MCP, gather the few editorial fields (type / difficulty / tags), then run
  the deterministic pipeline scripts to scaffold, sync, preview, and deploy. Use when the user says
  they did a new run / climb / ski / ride / scramble and wants it on the site, asks to sync Strava,
  or wants to whitelist / add a new activity to the adventures library.
---

# Add a new adventure

Your job is **high-level orchestration**: resolve which activity the user means, gather the small set
of genuinely-editorial fields from them, and run the pipeline scripts. Everything factual and every
unambiguous classification is **derived deterministically** — do not re-decide it. Call the scripts;
never reimplement them.

## What the pipeline derives (do NOT ask the human, do NOT set unless overriding)

- **sport** — from Strava `sport_type` (`mapSportType`). Override only for the site-only labels
  `Scramble` / `Mountaineering`.
- **title** — from the Strava activity name. Override only if the name is genuinely bad.
- **date**, **stats**, **location**, **map/track**, **photos**, **weather**, **gear** — from the snapshot.
- **race** (Run/Ride) — from Strava `workout_type` (1 = run race, 11 = ride race). Only set `race: true`
  by hand for races `workout_type` can't express (triathlon, ski marathon).
- **peakClass** (14er/13er) — from elevation.
- **group + laps** — auto-attached by GPS trailhead when the activity matches a known route
  (`adventure:new` does this). Only set `group` by hand to coin a **new** route key on the first repeat.

## What you DO gather from the human (the editorial residue)

- **type**: `peak | scramble | traverse | couloir | thru-hike | mountaineering` (omit if none fit)
- **difficulty**: `moderate | hard | epic`
- **tags**: range / place / route tokens (e.g. `[colorado, sawatch]`)
- Occasionally: a `title` cleanup, a `cover_photo`, `featured: true`, an `objective:` link, per-leg
  `days[].title` for multi-day outings, or coining a new `group` key.

Allowed values live in `lib/adventure-schema.ts` (the single source of truth) — the validator (step 4)
rejects anything off-vocabulary. Do not invent values.

## Prerequisites

- Be on `main` or a branch off it (the pipeline + `.env.local` with `STRAVA_CLIENT_ID/SECRET/REFRESH_TOKEN`
  must be present; copy `.env.local` from the primary checkout if missing). Run `npm ci` if `tsx` is absent.
- The activity index (`data/adventures/all-activities.json`) is **gitignored**, so a fresh checkout or
  worktree has none. Step 1 needs it — run `npm run sync:index` once if it's missing.

## Steps

### 1. Discover the activity

```bash
npm run adventure:find -- --unpublished --after <YYYY-MM-DD>
```

Prints id / date / sport / distance / gain / summit elevation / photo count for every activity not
already referenced by a companion. Narrow with `--sport <a,b>`, `--min-gain <ft>`, `--min-distance
<mi>`, `--min-high <ft>`, `--with-photos`, `--limit <n>` / `--all`, `--json`. No network, no
credentials — it reads the local index only. If it reports a missing or stale index run `npm run
sync:index` (or pass `--refresh`); the index is gitignored, so a fresh checkout has none.

*Optional accelerator:* the Strava MCP (`mcp__strava__strava__strava_list_activities` — note the
**doubled** `strava__` prefix from MCPJungle's tool-group namespacing) for fuzzy or interactive
lookup. It is not required, and the gateway truncates large listings at ~27KB mid-JSON, so prefer the
command above and reach for the MCP only when a natural-language lookup genuinely helps.

Confirm name + date + distance with the user; capture the **Strava id**.

### 2. Scaffold (auto-derives everything derivable)

```bash
npm run adventure:new -- <stravaId> --type <type> --difficulty <d> --tags <a,b>
```

Writes `content/adventures/<slug>.md` with `strava_id` + your editorial fields; auto-attaches `group`
+ `laps` by GPS when it matches a known route (it prints when it does). Leave derived fields unset.

### 3. Sync just this activity

```bash
npm run sync:strava -- --only <stravaId>
```

Targeted + O(1): fetches maps / photos / streams for this one id, refreshes the index + totals, and
persists any rotated token. (A plain `npm run sync:strava` also works — it now change-detects via a
cheap summary crawl and only fetches what changed — but `--only` skips even that.) Review `git status`:
expect new files under `data/adventures/activities/` + `public/adventures/<id>/`.

### 4. Validate + preview

```bash
npm run adventure:validate          # schema lint + a warning for any derivable frontmatter to drop
npm run build                       # or: npm run dev, then open /adventures/<slug>
```

Open `/adventures/<slug>` to confirm the map, stats, photos, and (if grouped) the trip card render.

### 5. Ship it

Commit the companion + synced data directly to `main` (solo project, **no PRs** — see AGENTS.md).
Verify locally first: `adventure:validate` + `npm run build`. Pushing `main` runs CI and triggers the
Vercel production deploy. Confirm it's live at `spencerboucher.com/adventures/<slug>`.

## Notes

- `sync:strava` only fetches ids referenced by a companion `.md`. A new activity does nothing until its
  companion exists — that's why scaffolding precedes syncing.
- Multi-leg / multi-day: use `strava_ids: [id1, id2]` and the `days:` block (see an existing multi-day
  companion); the scaffold handles the single-id case.
- A Strava **description-only** edit to an old activity isn't picked up by the cheap change-detection —
  reconcile it with `npm run sync:strava -- --only <id>` or `-- --force`.
