import { cache } from 'react';
import { getAllProjects } from '@/lib/content';
import type { Project } from '@/lib/types';
import type { ActivityData } from '@/components/ContributionCalendar';
import { readThrough } from '@/lib/last-good';

/**
 * Fetches the GitHub contribution graph for the last 365 days live at runtime: ALL activity,
 * private contributions included as bare per-day counts (the profile's "private contributions"
 * setting must stay on). Alongside it, a per-repo commit breakdown links calendar days to project
 * cards and a `pushedAt` map orders the cards by recency. Only repos listed in REPO_TO_SLUG are
 * attributed, public or private (a private repo with a documented or deployed card still counts),
 * and always by card slug, never repo name; every other repo contributes bare numbers.
 *
 * Requires a GITHUB_TOKEN (or GH_TOKEN). On any failure (missing token, API down, malformed
 * response) the fetcher throws and the last-good payload from Upstash is served instead; with no
 * Redis store the page renders an empty (all-zero) calendar. No committed snapshot — last-good
 * survives across deploys, so a deploy during a GitHub outage still renders the last real data.
 */

const OWNER = 'justmytwospence';

// GitHub repo name -> project card slug. This is the SOLE source of which repos the project page
// tracks (the calendar total still counts all repos; only listed ones link to a card and feed the
// recency sort). Repos not listed here don't link to a card. Feature ports share the portfolio
// umbrella for attribution; this does not imply those harness implementations moved into the suite.
export const REPO_TO_SLUG: Record<string, string> = {
  'pi-plugins': 'pi-plugins',
  'opencode-plugins': 'opencode-plugins',
  'pi-herdr': 'pi-plugins',
  'pi-bg': 'pi-plugins',
  'pi-diff-review': 'pi-plugins',
  'pi-prose-width': 'pi-plugins',
  'opencode-herdr': 'opencode-plugins',
  'opencode-prose-width': 'opencode-plugins',
  'opencode-git-status': 'opencode-plugins',
  'claude-prose-width': 'pi-plugins',
  bayesDAG: 'bayesdag',
  cloudposterior: 'cloudposterior',
  'arviz-mcp': 'arviz-mcp',
  'strava-mcp': 'strava-mcp',
  'ynab-mcp': 'ynab-mcp',
  'hardcover-mcp': 'hardcover-mcp',
  'inoreader-mcp': 'inoreader-mcp',
  'inoreader-obsidian': 'inoreader-obsidian',
  pacing: 'pacing',
  swimcue: 'swimcue',
  homelab: 'homelab',
  firsttracks: 'vertfarmer',
  'ifs-journal': 'ifs-journal',
  groundcover: 'groundcover',
  '29ers': '29ers',
  'fish-in-the-sea': 'fish-in-the-sea',
  'pi-cache-guard': 'pi-plugins',
  'claude-cache-guard': 'pi-plugins',
  'opencode-cache-guard': 'opencode-plugins',
  'codex-cache-guard': 'pi-plugins',
  'pi-auto-effort': 'pi-plugins',
  'claude-auto-effort': 'pi-plugins',
  'opencode-auto-effort': 'opencode-plugins',
  'pi-marimo': 'pi-plugins',
  'claude-marimo': 'pi-plugins',
  'opencode-marimo': 'opencode-plugins',
  'pi-tool-gate': 'pi-plugins',
  'claude-tool-gate': 'pi-plugins',
  'opencode-tool-gate': 'opencode-plugins',
  'pi-lean-context': 'pi-plugins',
  'opencode-lean-context': 'opencode-plugins',
  'pi-next-prompt': 'pi-plugins',
  'opencode-next-prompt': 'opencode-plugins',
  'anthropic-billing-guard': 'anthropic-billing-guard',
  'pi-plan-mode': 'pi-plugins',
  'pi-subagents': 'pi-plugins',
  'pi-status-footer': 'pi-plugins',
  'pi-copy': 'pi-plugins',
  'pi-ask-user-question': 'pi-plugins',
  'pi-rewind': 'pi-plugins',
  'pi-brokered-auth': 'pi-brokered-auth',
  'pi-select-nav': 'pi-plugins',
  'pi-clear-screen': 'pi-plugins',
  'pi-herdr-scrollbar-width': 'pi-plugins',
  'pi-appearance-resync': 'pi-plugins',
  'herdr-repeat-navigation': 'herdr-repeat-navigation',
  'tmux-agents': 'tmux-agents',
  'herdr-machine0': 'herdr-machine0',
  'paseo-machine0': 'paseo-machine0',
  'effort-curves': 'effort-curves',
  'telebrowser': 'telebrowser',
  'shipshape': 'shipshape',
  'minuspod-mcp': 'minuspod-mcp',
  'backup-mcp': 'backup-mcp',
  'paperless-mcp': 'paperless-mcp',
  'garmin-mcp': 'garmin-mcp',
  'herdr-git-status': 'herdr-git-status',
  'herdr-undo': 'herdr-undo',
  'herdr-agentbox': 'herdr-agentbox',
  'aac-touchid': 'aac-touchid',
  'agent-scrub': 'agent-scrub',
};

// The calendar spans exactly the last 365 days, ending today (UTC).
export const WINDOW_DAYS = 365;
// The per-repo breakdown is fetched in slices short enough that no repo can have more than 100
// commit days in one (the `contributions(first:100)` page size), so busy repos aren't truncated.
const SLICE_DAYS = 92;

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC day windows [from, to) covering the calendar, oldest first. */
export function activityWindow(now: Date): { start: Date; end: Date; slices: Array<[Date, Date]> } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const slices: Array<[Date, Date]> = [];
  for (let from = start; from <= end; from = new Date(from.getTime() + SLICE_DAYS * DAY_MS)) {
    const to = new Date(Math.min(from.getTime() + SLICE_DAYS * DAY_MS, end.getTime() + DAY_MS) - 1);
    slices.push([from, to]);
  }
  return { start, end, slices };
}

/**
 * One request: the full calendar (which counts private contributions too, anonymously, because
 * the profile shows private contributions) plus the per-repo commit breakdown, slice by slice.
 */
function buildQuery(sliceCount: number): string {
  const slices = Array.from({ length: sliceCount }, (_, i) => `
    s${i}: contributionsCollection(from:$f${i}, to:$t${i}){
      commitContributionsByRepository(maxRepositories:100){
        repository{ name isPrivate pushedAt }
        contributions(first:100){ nodes{ occurredAt commitCount } }
      }
    }`).join('');
  const vars = Array.from({ length: sliceCount }, (_, i) => `, $f${i}:DateTime!, $t${i}:DateTime!`).join('');
  return `query($login:String!, $from:DateTime!, $to:DateTime!${vars}){
  user(login:$login){
    calendar: contributionsCollection(from:$from, to:$to){
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
    }${slices}
  }
}`;
}

/** ActivityData plus a project-slug -> last-pushed (ISO date) map used to sort the project cards. */
export interface ProjectActivity extends ActivityData {
  updated: Record<string, string>;
  /** Project slug -> day -> commits. Absent from last-good payloads stored before it existed. */
  commits?: Record<string, Record<string, number>>;
}

/**
 * Also normalize last-good payloads written before a collection existed. Preserve contribution
 * counts (including private/unlisted work), dedupe day hover targets, and retain the latest push.
 */
export function rollUpProjectActivity(activity: ProjectActivity, projects: Project[]): ProjectActivity {
  const parents = new Map(projects.filter(p => p.parent).map(p => [p.slug, p.parent!]));
  const visibleSlug = (slug: string) => parents.get(slug) ?? slug;
  const days = Object.fromEntries(Object.entries(activity.days).map(([date, day]) => [
    date,
    { ...day, r: [...new Set(day.r.map(visibleSlug))].sort() },
  ]));
  const updated: Record<string, string> = {};
  for (const [slug, date] of Object.entries(activity.updated)) {
    const visible = visibleSlug(slug);
    if (!updated[visible] || date > updated[visible]) updated[visible] = date;
  }
  if (!activity.commits) return { ...activity, days, updated };
  const commits: Record<string, Record<string, number>> = {};
  for (const [slug, byDay] of Object.entries(activity.commits)) {
    const target = (commits[visibleSlug(slug)] ??= {});
    for (const [date, n] of Object.entries(byDay)) target[date] = (target[date] ?? 0) + n;
  }
  return { ...activity, days, updated, commits };
}

/**
 * Weekly commit totals per project, one point per calendar column (Sunday-to-Saturday weeks from the
 * Sunday on or before the window start), oldest first. Payloads without per-day commit counts fall
 * back to counting each active day once.
 */
export function projectSparklines(activity: ProjectActivity): Record<string, number[]> {
  const end = Date.parse(`${activity.endDate}T00:00:00Z`);
  const start = activity.startDate ? Date.parse(`${activity.startDate}T00:00:00Z`) : end - (WINDOW_DAYS - 1) * DAY_MS;
  const gridStart = start - new Date(start).getUTCDay() * DAY_MS;
  const weeks = Math.floor((end - gridStart) / (7 * DAY_MS)) + 1;
  const commits = activity.commits ?? {};
  if (!activity.commits) {
    for (const [date, day] of Object.entries(activity.days)) {
      for (const slug of day.r) (commits[slug] ??= {})[date] = 1;
    }
  }
  const series: Record<string, number[]> = {};
  for (const [slug, byDay] of Object.entries(commits)) {
    const points = new Array<number>(weeks).fill(0);
    for (const [date, n] of Object.entries(byDay)) {
      const t = Date.parse(`${date}T00:00:00Z`);
      if (t < start || t > end) continue;
      points[Math.floor((t - gridStart) / (7 * DAY_MS))] += n;
    }
    if (points.some((n) => n > 0)) series[slug] = points;
  }
  return series;
}

function emptyActivity(): ProjectActivity {
  const { start, end } = activityWindow(new Date());
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end), maxCount: 0, total: 0, days: {}, updated: {} };
}

/** Live fetch. THROWS on any failure so last-good can serve the previous payload. */
async function fetchActivity(): Promise<ProjectActivity> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('[github-activity] no GITHUB_TOKEN / GH_TOKEN');

  const now = new Date();
  const { start, end, slices } = activityWindow(now);
  const variables: Record<string, string> = {
    login: OWNER,
    from: start.toISOString(),
    to: now.toISOString(),
  };
  slices.forEach(([from, to], i) => {
    variables[`f${i}`] = from.toISOString();
    variables[`t${i}`] = to.toISOString();
  });

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: buildQuery(slices.length), variables }),
    signal: AbortSignal.timeout(10_000),
    // ETag/If-None-Match (and the "304 doesn't count against quota" rule) are REST features; this is
    // a GraphQL query that doesn't honor them, so no conditional requests. ISR caps this to ~1
    // fetch/hr against a 5000/hr budget; last-good covers outages.
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`[github-activity] HTTP ${res.status}`);
  const json = await res.json();
  const user = json?.data?.user;
  const calendar = user?.calendar?.contributionCalendar;
  if (!calendar) throw new Error('[github-activity] missing contributionCalendar');

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const inWindow = (date: string) => date >= startDate && date <= endDate;

  // Every contribution counts toward the calendar, private ones included (as bare numbers).
  const days: Record<string, { c: number; r: string[] }> = {};
  let maxCount = 0;
  let total = 0;
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      if (!inWindow(day.date) || day.contributionCount <= 0) continue;
      days[day.date] = { c: day.contributionCount, r: [] };
      total += day.contributionCount;
      if (day.contributionCount > maxCount) maxCount = day.contributionCount;
    }
  }

  // Attribute each project's commit days (for day<->card hover linking) and capture its last push
  // date (for the recency sort) in one pass over the tracked repos.
  const updated: Record<string, string> = {};
  const commits: Record<string, Record<string, number>> = {};
  const repos = slices.flatMap((_, i) => user?.[`s${i}`]?.commitContributionsByRepository ?? []);
  for (const repo of repos) {
    // Only repos with a project card are attributed (by card slug, never by repo name); private
    // repos with a card (documented or deployed but closed-source) count too. Everything else stays
    // a bare number.
    const slug = REPO_TO_SLUG[repo.repository?.name];
    if (!slug) continue;
    const pushedAt = repo.repository?.pushedAt;
    if (pushedAt) {
      const iso = String(pushedAt).slice(0, 10);
      if (!updated[slug] || iso > updated[slug]) updated[slug] = iso;
    }
    for (const node of repo.contributions?.nodes ?? []) {
      const date = String(node.occurredAt).slice(0, 10);
      if (!inWindow(date)) continue;
      const entry = days[date] ?? (days[date] = { c: 0, r: [] });
      if (!entry.r.includes(slug)) entry.r.push(slug);
      const byDay = (commits[slug] ??= {});
      byDay[date] = (byDay[date] ?? 0) + (Number(node.commitCount) || 1);
    }
  }
  for (const key of Object.keys(days)) days[key].r.sort();

  return { startDate, endDate, maxCount, total, days, updated, commits };
}

/**
 * The project activity for the page. Deduped per render via React cache (so the page can read both
 * the calendar and the `updated` sort map from one fetch even if rendered concurrently). Wrapped in
 * last-good so a failed fetch serves the previous payload; falls back to an empty calendar.
 */
export const getActivity = cache(async (): Promise<ProjectActivity> => {
  try {
    const activity = (await readThrough<ProjectActivity>('github-activity', fetchActivity)) ?? emptyActivity();
    return rollUpProjectActivity(activity, getAllProjects());
  } catch {
    // No Redis store and the fetch failed (no token, API down, etc.): render an empty calendar.
    return emptyActivity();
  }
});
