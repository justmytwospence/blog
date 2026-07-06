# Adventure stats — runtime store (no git, event-driven)

The rolling lifetime/yearly stats are **not committed**. They live in **Upstash Redis** and update
**only when you log/edit a Strava activity** (the webhook), then the `/adventures` page revalidates.
Per-adventure trip reports, photos, and objectives stay in git — only the churning stats moved out.

```
Strava activity ─▶ POST /api/strava/webhook ─▶ (after 200) crawl + buildTotals
                                              ─▶ redis SET strava:totals ─▶ revalidatePath('/adventures')
/adventures render ─▶ redis GET strava:totals   (one fast lookup, never calls Strava)
```

No GitHub Action, no `repository_dispatch`, no PATs, no commits.

## One-time setup (Vercel)

1. **Add Upstash Redis** — Vercel → Storage / Marketplace → **Upstash → Redis** (free tier). Linking
   injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or legacy `KV_REST_API_*`; the code
   accepts either).
2. **Env vars** (Project → Settings → Environment Variables):
   - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`
   - `STRAVA_VERIFY_TOKEN` (already set — webhook handshake)
   - `STRAVA_SUBSCRIPTION_ID` (optional — restricts events to your subscription)
   - `CRON_SECRET` (recommended — guards the daily reconcile route; Vercel Cron sends it as a
     `Authorization: Bearer` header. Without it the route falls back to the internal `x-vercel-cron`
     header check.)
   - **Remove** `GH_DISPATCH_TOKEN` — no longer used.
3. **Seed the store** so the page shows real numbers immediately (not "0 all-time"):
   ```bash
   vercel env pull .env.local      # pulls the Upstash creds locally
   npm run seed:redis              # crawl + buildTotals → strava:totals (+ strava:auth)
   ```
4. **Subscribe** (if not already): `npm run webhook:subscribe`.

## Reconcile safety-net (daily cron)

Strava retries a webhook event ~3× then gives up. If the *last* event of a streak is the one that's
dropped, the totals would stay stale until the next activity (possibly weeks). A daily Vercel cron
(`vercel.json` → `/api/strava/reconcile`, `0 5 * * *`) recomputes the totals from a full crawl —
the same `recomputeTotals()` the webhook runs. Once-daily works on the free Hobby tier (1 cron/day);
no Pro upgrade needed. The route is guarded by `CRON_SECRET` (Vercel sends it automatically) so it
isn't publicly triggerable, and no-ops cleanly with no Redis store. `npm run sync:strava` remains the
manual backstop.

## Token rotation (handled)

`getAccessToken()` persists any rotated Strava refresh token to `strava:auth` and prefers it over the
env seed, so rotation survives across invocations (a Vercel env var can't be written at runtime). The
`STRAVA_REFRESH_TOKEN` env var is the bootstrap / break-glass.

**Break-glass:** if the stored auth ever gets into a bad state, delete the key and redeploy:
```bash
# via the Upstash console, or any redis client:  DEL strava:auth
```
The next mint falls back to the `STRAVA_REFRESH_TOKEN` env seed.

**Multi-store hazard (know this):** the same Strava app's refresh token is held by *independent*
consumers — this blog in prod (Redis `strava:auth`), local authoring (`.env.local` /
`.strava-token.json`), and the homelab **Strava MCP gateway** (its own copy). Strava rotates the
refresh token on some refreshes, which invalidates the *other* copies. In practice prod self-heals
(it persists its own rotations to Redis) and the local `sync:strava` self-heals (it persists to
`.strava-token.json`), but a rotation in one place can still break another. If auth dies anywhere:
re-seed that consumer — prod: `DEL strava:auth` + `npm run seed:redis`; local: refresh
`STRAVA_REFRESH_TOKEN` in `.env.local` (delete `.strava-token.json`); MCP gateway: reissue its token.
Unifying these onto one store is intentionally deferred.

## Local dev

No Redis env locally → the page reads a **gitignored** `data/adventures/{lifetime,yearly}-totals.json`
(or renders an empty state if absent). Populate it with `npm run totals:refresh`. With Upstash creds
pulled (`vercel env pull`), dev reads the live store instead.

## Footnote

Free Upstash DBs archive after ~14 days of zero commands. Your activity writes + the page's hourly
ISR reads normally keep it warm; if it ever sleeps after a totally quiet fortnight, restore it in the
Upstash console (no data lost).
