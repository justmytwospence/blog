# Deployment operations

## Branches and hosts

| Git branch | Vercel environment | Host |
| --- | --- | --- |
| `main` | Production | `spencerboucher.com` redirects to `www.spencerboucher.com` |
| `dev` | Preview | `dev.spencerboucher.com` |
| Bare-slug feature branch | Preview | Generated Vercel URL and `<branch>.dev.spencerboucher.com`, added by its own build |

Git is the source of truth. Do not deploy CLI snapshots, move preview aliases, or promote a preview
artifact instead of pushing Git. Vercel builds Production separately from the reviewed Preview
because credentials and runtime behavior differ. The source commit must be the same.

This is a solo project: no pull request ceremony. GitHub's development/default branch is `dev` after
bootstrap; Vercel's production branch remains `main`. Branch URLs follow the latest deployment;
immutable deployment URLs identify a specific build. Always record the Git SHA with a reviewed URL.

### Provider identities

- GitHub: `justmytwospence/blog`.
- Vercel project: `blog`, ID `prj_3tr1ZXKedofvZs88iTvd9OqHSn4J`.
- Vercel scope: `spencers-projects-19cee858`, team `team_TwgeP3rwrsOV5S5i2hX1oJIx`.
- Cloudflare zone: `spencerboucher.com`, ID `97a04cd419081b224d62c57ca45c9d3b`.
- DNS-only CNAMEs `dev.spencerboucher.com` and `*.dev.spencerboucher.com` point to
  `3b7a51e1b3be3b59.vercel-dns-016.com`, the project's existing Vercel DNS target.
- The team owns `spencerboucher.com` on Vercel, so a branch subdomain verifies as soon as it is added:
  no `_vercel` TXT record and no Cloudflare token.
- Production Redis: Vercel store `store_717CdDzavRXdawOY`, provider database
  `adc97b4c-0f67-4d23-bb0c-8e7e902d8898` (`blog`); its project connection is Production only.
- Preview Redis: Vercel store `store_QprAdba6yzDROOon`, provider database
  `87e7f3b7-9ce0-4781-bee5-58583858b5e9` (`blog-preview`); Free plan, primary region `pdx1`,
  no read replicas, auto-upgrade/Prod Pack disabled, no automatic project connection.

These are the intended configured state, not proof rollout is complete. Verify live configuration
during bootstrap; preserve existing apex/www routing, mail DNS, and unrelated project settings.

## Daily preview workflow

Work on `dev`, or a bare lowercase slug feature branch for independent work. Feature names match
`[a-z0-9]+(?:-[a-z0-9]+)*` and are at most 63 characters. Do not create a worktree unless requested.

```sh
npm run lint
npm run typecheck
npm run test
npm run adventure:validate
npm run build
```

Commit only your own changes, by path, with atomic conventional commits. Then:

```sh
npm run preview:push
```

This is the authorized no-extra-ask preview path. It accepts no arguments, requires a clean tracked
working tree and the exact blog origin push URL, and pushes only HEAD to the current nonproduction
branch. Pre-existing untracked files are left alone. Main/master, detached HEAD, force/delete/tag
pushes, alternate remotes, and arbitrary refspecs are refused. Direct `git push` still requires
approval; never use it to bypass this validation.

Wait for **both** the exact SHA's successful **push** `CI / verify` run and a Ready Git-triggered
Vercel Preview deployment. CI runs every branch push, PRs targeting dev/main, and manual dispatch.
A successful Vercel build alone is not evidence tests passed.

```sh
git rev-parse HEAD
gh run list --branch dev --workflow ci.yml --limit 5
gh run watch <run-id> --exit-status
```

Replace `dev` when reviewing a feature branch. Inspect deployment provenance, branch, environment,
and commit SHA through Vercel after obtaining the required approval for project/API reads. Confirm
project and team identities before consequential reads or writes. The globally installed CLI 48.6.0
supports `vercel project inspect blog --scope spencers-projects-19cee858`, but lacks
`--non-interactive`, `api`, and the newer storage connection commands. Use
`fresh npx --yes vercel@65.16.0` as the command prefix for those operations without upgrading the
global installation. Prefer supported CLI operations; use approved provider APIs only when needed,
with credentials injected and output filtered to nonsecret metadata.

### Feature domains

Every Vercel Preview build gives its branch `<branch>.dev.spencerboucher.com` by itself: `npm run build`
runs `tsx scripts/preview-domain.ts --build` before `next build`. It adds the domain to the project
bound to the branch, using the Preview-only sensitive `PREVIEW_DOMAIN_TOKEN` (a Vercel token scoped to
this project), and logs `preview domain: https://<host>`. It skips (`preview domain: skipped (<reason>)`)
outside Preview builds, without a branch or token, and for the reserved `main`, `master`, `dev` and
`www`; any failure is logged as `preview domain: not added: <message>` and never fails the build.
A push builds the branch, so the host appears with the first deployment.

The manual commands remain for a branch that needs the domain before a build, or its removal:

```sh
npm run preview:domain -- <branch>
npm run preview:domain -- <branch> --remove
```

They need the existing Vercel domain/API approval and a Vercel credential: `PREVIEW_DOMAIN_TOKEN`,
`VERCEL_TOKEN`, or the CLI's existing login, in that order. No Cloudflare access is involved. Never
paste tokens into chat, command arguments, or tracked files.

Wildcard DNS only routes traffic: each hostname still needs an exact Vercel branch binding. The tool
checks the blog project/team, refuses another branch's binding, and fails if the domain comes back
unverified (the team should own the apex). Repeating add/remove is safe.

Remove the mapping after the branch lands, then deliberately delete the branch. Keep wildcard DNS and
the stable dev domain. The feature tool cannot add/remove dev/main or www. Stable dev provisioning is
a separate, explicit operation.

## Preview data: sanitized snapshot

Production keeps its existing Redis. Dev and feature previews share a separate database named
`blog-preview`, populated with public display data, not a full database clone. This avoids copying
Strava auth and the cost/lifecycle overhead of one database per feature branch.

Vercel Preview receives only these Redis variables:

- `BLOG_PREVIEW_REDIS_REST_URL`
- `BLOG_PREVIEW_REDIS_REST_TOKEN`

Preview never falls back to production `UPSTASH_*` or `KV_*` variables. Without its complete pair it
has no store and uses existing graceful page fallbacks. Production/local retain the established
Upstash/KV credential precedence. No production Redis URL/token or Strava refresh credentials belong
in Preview or ordinary GitHub CI. A production read-only Redis token is also unsafe there: it can
read the secret `strava:auth` key.

### Snapshot refresh

Run maintenance locally with approved credential injection. The copier requires explicit
`PREVIEW_SOURCE_REDIS_REST_URL/TOKEN` for a **read-only production source**, and
`BLOG_PREVIEW_REDIS_REST_URL/TOKEN` for the writable preview target. It does not load `.env.local`.

These are Vercel-managed Upstash resources, not a separate native Upstash account. From Vercel
Storage, choose the resource and **Open in Upstash** (SSO), then open its **Details** page. The
**HTTPS** and **READONLY TOKEN** copy controls provide the source connection; **HTTPS** and **TOKEN**
provide the target connection. Use the distinct source/target database IDs above to confirm identity.
Do not reset credentials or create another account. The native-account Developer API key flow is not
supported for Vercel-created accounts and is unnecessary here.

Existing Secret-type Vercel environment values cannot be exported through `env run`/`env pull`;
regular CLI login does not change that. Do not guess storage-secret API endpoints or weaken
Production-only protection. Use the authorized provider console's existing REST tokens with approved
credential injection. For browser-assisted transfer, keep plaintext credentials in browser/child
process memory only, encrypt transport with an ephemeral key, and never return token values in tool
results, logs, clipboard history, or local credential files. Destroy the temporary transfer process
and restore masked UI controls immediately after use.

```sh
npm run preview:seed -- --confirm-target <actual-preview-hostname>
```

Use the provisioned preview Redis hostname, not the site's dev hostname. The command refuses
non-HTTPS or equal source/target origins and requires the target confirmation before making requests.
It reads only these exact keys:

```text
strava:totals
strava:totals:updatedAt
last-good:strava:totals
last-good:github-history
last-good:github-activity
last-good:hardcover:recent-books
last-good:hardcover:reading-list:v2
last-good:inoreader:blogroll
last-good:inoreader:feeds
```

It reads every source value before writing, requires existing totals, copies present keys, and deletes
only missing allowlisted base keys. It never scans, copies `strava:auth`, flushes a database, writes
to the source, or deletes branch caches. Output contains counts and completion time, never values.
`preview:snapshot:updatedAt` marks successful completion. A target failure may leave a partial copy;
fix the reported problem and rerun the same confirmed target operation. There is no refresh cron or
build-time seed. Refresh explicitly when newer totals/base fallback data are needed.

Preview live fetches still run under existing ISR windows. Successful fallback-cache writes use
`preview:<URL-encoded-git-branch>:last-good:<key>` and expire after seven days (an explicitly shorter
TTL wins). On upstream failure a branch reads its own cached value first, then the base snapshot.
This prevents one branch's experimental cache shape from poisoning another branch. Totals themselves
are shared snapshot reads. This is not a sandbox for future mutable application-domain migrations;
add actual per-branch stores when such a feature exists.

### Strava and other upstream services

Runtime `writeTotals`, `getAccessToken`, and `recomputeTotals` require
`VERCEL_ENV=production`. Webhook GET/POST and reconcile GET return 404 elsewhere before parsing,
authentication, scheduling work, or refreshing tokens. `NODE_ENV=production` is not sufficient:
preview builds use it too. Keep cron and Strava subscription targets on Production only.

Local authoring/maintenance scripts remain independent; the preview seed never calls them or Strava.
See [Strava stats](strava-stats.md) for production setup, seeding, and token rotation. Existing
visitor-authorized Bluesky replies remain real replies on every supported origin; deployment data
isolation does not create a Bluesky sandbox. GitHub/Hardcover/Inoreader reads remain unchanged.

## Bootstrap and infrastructure changes

1. Verify identities and existing settings; obtain fresh approval for Vercel reads/writes and each
   production-affecting operation. Plan approval is not publication/configuration approval.
2. Provision standalone `blog-preview` Redis in production's region. Show current pricing and obtain
   approval before creating a billable resource. Do not attach it to Production through an integration.
3. Seed the allowlisted snapshot with the confirmed preview target. Store credentials through approved
   secret handling; never log or commit them.
4. Set dedicated preview Redis variables only in Preview. Remove Preview scope from the existing
   `REDIS_URL`, `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and
   `KV_REST_API_READ_ONLY_TOKEN` integration entries, preserving Production values/scopes. These
   shared-scope edits require production configuration approval. Also update the production store's
   **connection metadata** to Production only, or a future integration sync could recreate Preview
   variables. Inspect with `fresh npx --yes vercel@65.16.0 storage status blog`; after explicit approval,
   use `fresh npx --yes vercel@65.16.0 storage update blog --project blog --environment production --yes`
   with the verified team scope. This re-scopes existing credentials, not a database reset or token
   rotation. Remove Preview-only
   `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`, and `CRON_SECRET`.
   Preserve preview GitHub/Hardcover read credentials and unrelated variables. Read back metadata only.
5. Add the two DNS-only CNAMEs above, requiring absent or exactly matching existing records; stop on
   conflicts. Bind `dev.spencerboucher.com` to Preview branch dev; the team-owned apex verifies it at once.
   Never change production domains, apex redirect, productionBranch, or unrelated DNS.
6. Push dev through the wrapper and verify CI, Ready deployment, domain/SHA, and acceptance checks.
7. Obtain approval and configure main protection: GitHub Actions app ID **15368**, required check
   **verify**, `strict: false`, `enforce_admins: true`, no required PR, no force pushes, no deletion.
   No status-check bypass. Make dev GitHub's default branch after its successful deployment; leave
   Vercel's production branch main. Read back settings.
8. Exercise a temporary `deployment-check` branch/domain at the reviewed SHA; verify and remove it,
   deliberately approve the direct remote-branch deletion push, and return to dev.
9. Stop at verified Preview. Production publication requires the separate approvals below.

## Production promotion

Only promote the reviewed dev SHA. GitHub's main protection rejects a new commit without successful
`verify`; normal main-push CI is after publication and is not the prepublication gate.

1. Require a clean tracked tree, fetch origin, and ensure local dev matches origin/dev.
2. Load the `commit-hygiene` skill, run `git tidy` on dev, and read its output. Fix history into logical
   conventional commits. If rewritten, obtain approval for a deliberate explicit
   `git push --force-with-lease origin dev`, then reverify the **new** SHA's push CI and Preview build.
3. Record verified dev SHA, preview URL, and successful CI. Require origin/main is its ancestor. If
   histories diverge, reconcile on dev and repeat checks; do not create an untested main merge commit.
4. Obtain **current-turn approval immediately before** switching to main and fast-forwarding:
   `git switch main && git merge --ff-only origin/dev`. Refuse an unexpected local main state.
5. Obtain **separate current-turn approval immediately before** publishing:
   `git push origin HEAD:refs/heads/main`. Never use an implicit push, force push, squash, or preview
   alias promotion.
6. Wait for the Production deployment; verify its Git SHA equals reviewed dev, smoke-check production,
   and return the checkout to dev. Report the actual Git publication path and verification results.

Every production operation requires current-turn approval, including deployments, main merges/pushes,
promotions, aliases, rollback, protection changes, and production environment/domain/project writes.
Direct Git pushes and Vercel env/project/domain/API reads/MCP calls still ask. The preview push wrapper
is a narrowly validated normal path, not permission to wrap arbitrary production operations in scripts.
String rules/classifier guidance are not an OS sandbox; an administrator can change provider policies.

### Rollback

Revert the bad change on dev, verify it, and publish through the same approved fast-forward process.
Never rewrite main. Emergency Vercel rollback requires explicit incident approval; afterward reconcile
the deployed code back into Git so main is authoritative again. Do not leave an alias-only rollback
as the permanent state.

## Acceptance checks

- Verify the exact Git SHA in successful push CI and the Ready Vercel deployment, not just a URL.
- Fetch dev root, blog, projects, adventures, reading, and blogroll. Adventure totals should match the
  seed snapshot. Check map/photos/report rendering during adventure publication.
- Check `X-Robots-Tag: noindex, nofollow` on dev `/`, `/sitemap.xml`, `/feed.xml`, and `/human.json`;
  root HTML also contains robots noindex metadata. Production must not acquire preview directives.
  Existing production canonical/feed/sitemap URLs are intentional, not preview-host identities.
- On **preview only**, webhook GET/POST and reconcile GET return 404, including a relevant dummy
  activity POST. No refresh work is scheduled. Never send a dummy POST to production.
- Read back domain bindings, DNS, protection/default-branch settings, and env names/scopes without
  values. Confirm existing production root/www routing has not changed.
- After a separately approved promotion, verify production SHA, root/blog/adventures, feeds, and
  sitemap; confirm cron/webhook configuration remains production-only.

Automated coverage lives in `lib/__tests__/{deployment,redis,last-good,strava-deployment,deployment-headers}.test.ts`
and `scripts/__tests__/{preview-seed,push-preview,preview-domain}.test.ts`. Full commands are lint,
typecheck, tests, adventure validation, and build. For explicit production build tests on a workstation,
blank Redis environment variables first so `.env.local` cannot turn a build into production cache writes:

```sh
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= KV_REST_API_URL= KV_REST_API_TOKEN= \
  BLOG_PREVIEW_REDIS_REST_URL= BLOG_PREVIEW_REDIS_REST_TOKEN= \
  VERCEL_ENV=production npm run build
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= KV_REST_API_URL= KV_REST_API_TOKEN= \
  BLOG_PREVIEW_REDIS_REST_URL= BLOG_PREVIEW_REDIS_REST_TOKEN= \
  VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=dev npm run build
```
