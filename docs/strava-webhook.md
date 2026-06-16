# Strava webhook → auto-refreshed totals

When a Strava activity lands, a webhook hits a Vercel route that fires a GitHub
`repository_dispatch`, which runs the `strava-sync` workflow to refresh and commit
the totals. The commit to `main` triggers a Vercel redeploy. Result: the site's
committed lifetime/yearly totals update a few minutes after a new ride or hike.

## How it works

Strava POSTs a minimal event (ids only, no activity detail) to
`https://spencerboucher.com/api/strava/webhook`. The route filters to
`object_type: activity` with `aspect_type` create/update/delete (and, if
`STRAVA_SUBSCRIPTION_ID` is set, a matching `subscription_id`), then fires a
parameter-less `repository_dispatch` of type `strava-activity` to
`justmytwospence/blog` and returns HTTP 200 within Strava's 2-second budget. The
`strava-sync` GitHub Action runs `npm run totals:refresh` (a cheap incremental
index fetch + recompute), propagates any rotated Strava refresh token back into
the Actions secret, then commits `data/adventures` and pushes to `main`.

## Secrets to add

### Vercel (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `STRAVA_VERIFY_TOKEN` | A random string you choose. Strava echoes it during the validation handshake; the route compares it. Must match the value you pass to `webhook:subscribe`. |
| `GH_DISPATCH_TOKEN` | A fine-grained GitHub PAT scoped to `justmytwospence/blog` with **Contents: write** (required for `repository_dispatch`). |
| `STRAVA_SUBSCRIPTION_ID` | *(optional, recommended)* The id returned by `webhook:subscribe`. When set, the route rejects events from other subscriptions. |

### GitHub Actions (Repo → Settings → Secrets and variables → Actions)

| Name | Value |
|---|---|
| `STRAVA_CLIENT_ID` | Strava app client id. |
| `STRAVA_CLIENT_SECRET` | Strava app client secret. |
| `STRAVA_REFRESH_TOKEN` | Strava refresh token (the workflow rotates this for you over time — see below). |
| `STRAVA_TOKEN_ROTATE_PAT` | *(optional, strongly recommended)* A PAT with **Actions: read/write** (secrets:write) on the repo. Lets the workflow update `STRAVA_REFRESH_TOKEN` after Strava rotates it. Without it, the workflow prints a warning and you must update `STRAVA_REFRESH_TOKEN` by hand the next time auth fails. |

> The `gh` CLI used for token propagation is preinstalled on GitHub-hosted
> runners. The push itself uses the default `GITHUB_TOKEN` (`contents: write`).

## One-time setup (subscribe)

1. Deploy the webhook route and set `STRAVA_VERIFY_TOKEN` (and `GH_DISPATCH_TOKEN`)
   in Vercel.
2. Set the same `STRAVA_VERIFY_TOKEN` locally in `.env.local` (plus the usual
   `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`).
3. Run:

   ```bash
   npm run webhook:subscribe
   ```

   This POSTs to Strava with `callback_url=https://spencerboucher.com/api/strava/webhook`.
   Strava immediately GETs that callback with `hub.challenge`; the route echoes it
   only if `hub.verify_token` matches. On success it prints the subscription id.
4. Set that id as `STRAVA_SUBSCRIPTION_ID` in Vercel (optional but recommended).

Strava allows exactly **one** subscription per app. To change the callback URL,
delete and recreate.

## Verify and tear down

```bash
npm run webhook:view          # show the current subscription (id, callback_url, timestamps)
npm run webhook:delete <id>   # remove it
```

You can also trigger the sync manually from the GitHub Actions UI
(`strava-sync` → Run workflow) without any Strava event.

## Security notes

- The route validates `hub.verify_token` on GET and (optionally)
  `subscription_id` on POST. It does no writes and triggers only a fixed,
  parameter-less dispatch, so a spoofed POST at worst kicks a harmless,
  idempotent sync.
- `GH_DISPATCH_TOKEN` and `STRAVA_TOKEN_ROTATE_PAT` are the sensitive credentials
  here; scope both as narrowly as possible (single repo, minimum permissions).
- The Strava refresh token rotates. The workflow propagates it automatically when
  `STRAVA_TOKEN_ROTATE_PAT` is present; otherwise update `STRAVA_REFRESH_TOKEN`
  manually when prompted by the workflow warning.
