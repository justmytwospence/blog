# Strava webhook → live totals (Upstash Redis)

When a Strava activity lands, a webhook hits a Vercel route that recomputes the rolling
lifetime/yearly totals and writes them to **Upstash Redis** (`strava:totals`), then revalidates
`/adventures`. No GitHub Action, no `repository_dispatch`, no commits — the totals are runtime state,
not git. The per-adventure trip reports (`data/adventures/activities/*.json`) stay in git and are
authored separately via `npm run sync:strava`.

> **`docs/strava-stats.md` is the source of truth** for the store, seeding, the reconcile cron, and
> token rotation. This file covers the webhook subscription itself.

## How it works

Strava POSTs a minimal event (ids only, no activity detail) to
`https://spencerboucher.com/api/strava/webhook` (`app/api/strava/webhook/route.ts`). The route:

1. Filters to `object_type: activity` with `aspect_type` create/update/delete (and, if
   `STRAVA_SUBSCRIPTION_ID` is set, a matching `subscription_id`).
2. Schedules `recomputeTotals()` in `after()` and returns HTTP 200 immediately — inside Strava's
   ~2-second budget. `recomputeTotals()` (`lib/strava-store.ts`) does a cheap summary crawl
   (`crawlActivities` → ~a handful of GETs), `buildTotals`, `SET strava:totals`, then
   `revalidatePath('/adventures')`.

A dropped event self-heals: the daily reconcile cron (`app/api/strava/reconcile`, `vercel.json`
`0 5 * * *`) runs the same full recompute. `npm run sync:strava` is the manual backstop.

## Secrets

### Vercel (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `STRAVA_VERIFY_TOKEN` | A random string you choose. Strava echoes it during the validation handshake; the route compares it. Must match the value you pass to `webhook:subscribe`. |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` / `STRAVA_REFRESH_TOKEN` | Strava app credentials. The refresh token is the bootstrap seed; rotations are persisted to Redis `strava:auth` (see `docs/strava-stats.md`), so you rarely touch it. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Injected by the Upstash Vercel integration (legacy `KV_REST_API_*` also accepted). The store the webhook writes and `/adventures` reads. |
| `STRAVA_SUBSCRIPTION_ID` | *(optional, recommended)* The id returned by `webhook:subscribe`. When set, the route rejects events from other subscriptions. |
| `CRON_SECRET` | *(recommended)* Guards the daily reconcile route; Vercel Cron sends it as a Bearer header. |

There is no GitHub-side secret anymore — `GH_DISPATCH_TOKEN` and `STRAVA_TOKEN_ROTATE_PAT` are gone.

## One-time setup (subscribe)

1. Deploy the webhook route and set `STRAVA_VERIFY_TOKEN` in Vercel (plus the Upstash + Strava creds).
2. Set the same `STRAVA_VERIFY_TOKEN` locally in `.env.local` (plus `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`).
3. Seed the store so the page shows real numbers immediately: `npm run seed:redis` (see strava-stats.md).
4. Subscribe:

   ```bash
   npm run webhook:subscribe
   ```

   This POSTs to Strava with `callback_url=https://spencerboucher.com/api/strava/webhook`. Strava
   immediately GETs that callback with `hub.challenge`; the route echoes it only if `hub.verify_token`
   matches. On success it prints the subscription id.
5. Set that id as `STRAVA_SUBSCRIPTION_ID` in Vercel (optional but recommended).

Strava allows exactly **one** subscription per app. To change the callback URL, delete and recreate.

## Verify and tear down

```bash
npm run webhook:view          # show the current subscription (id, callback_url, timestamps)
npm run webhook:delete <id>   # remove it
```

To recompute totals on demand without a Strava event, hit the reconcile route (with `CRON_SECRET`) or
run `npm run seed:redis`.

## Security notes

- The route validates `hub.verify_token` on GET and (optionally) `subscription_id` on POST. It writes
  only the derived totals to Redis and triggers a fixed, idempotent recompute, so a spoofed POST at
  worst kicks a harmless recompute.
- The Strava refresh token rotates; rotations are persisted to Redis `strava:auth` and preferred over
  the env seed, so no manual propagation is needed. Break-glass: `DEL strava:auth` + redeploy (falls
  back to the `STRAVA_REFRESH_TOKEN` env seed). See `docs/strava-stats.md`.
