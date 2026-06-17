import { cache } from 'react';
import type { ActivityData } from '@/components/ContributionCalendar';
import { readThrough } from '@/lib/last-good';

/**
 * Fetches the GitHub contribution graph (ALL activity, including private contribution counts) live
 * at runtime, plus a per-repo commit breakdown used to link calendar days to project cards and a
 * `pushedAt` map used to order the project cards by recency.
 *
 * Requires a GITHUB_TOKEN (or GH_TOKEN). On any failure (missing token, API down, malformed
 * response) the fetcher throws and the last-good payload from Upstash is served instead; with no
 * Redis store the page renders an empty (all-zero) calendar. No committed snapshot — last-good
 * survives across deploys, so a deploy during a GitHub outage still renders the last real data.
 */

const OWNER = 'justmytwospence';

// GitHub repo name -> project card slug. This is the SOLE source of which repos the project page
// tracks (the calendar total still counts all repos; only listed ones link to a card and feed the
// recency sort). Repos not listed here don't link to a card.
const REPO_TO_SLUG: Record<string, string> = {
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
};

const QUERY = `query($login:String!, $from:DateTime!, $to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from, to:$to){
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
      commitContributionsByRepository(maxRepositories:100){
        repository{ name pushedAt }
        contributions(first:100){ nodes{ occurredAt commitCount } }
      }
    }
  }
}`;

/** ActivityData plus a project-slug -> last-pushed (ISO date) map used to sort the project cards. */
export interface ProjectActivity extends ActivityData {
  updated: Record<string, string>;
}

function emptyActivity(): ProjectActivity {
  return { endDate: new Date().toISOString().slice(0, 10), maxCount: 0, total: 0, days: {}, updated: {} };
}

/** Live fetch. THROWS on any failure so last-good can serve the previous payload. */
async function fetchActivity(): Promise<ProjectActivity> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('[github-activity] no GITHUB_TOKEN / GH_TOKEN');

  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login: OWNER, from: from.toISOString(), to: to.toISOString() },
    }),
    signal: AbortSignal.timeout(10_000),
    // ETag/If-None-Match (and the "304 doesn't count against quota" rule) are REST features; this is
    // a GraphQL query that doesn't honor them, so no conditional requests. ISR caps this to ~1
    // fetch/hr against a 5000/hr budget; last-good covers outages.
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`[github-activity] HTTP ${res.status}`);
  const json = await res.json();
  const cc = json?.data?.user?.contributionsCollection;
  if (!cc?.contributionCalendar) throw new Error('[github-activity] missing contributionCalendar');

  const days: Record<string, { c: number; r: string[] }> = {};
  let maxCount = 0;
  let endDate = '';
  for (const week of cc.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.date > endDate) endDate = day.date;
      if (day.contributionCount > 0) {
        days[day.date] = { c: day.contributionCount, r: [] };
        if (day.contributionCount > maxCount) maxCount = day.contributionCount;
      }
    }
  }

  // Attribute each project's commit days (for day<->card hover linking) and capture its last push
  // date (for the recency sort) in one pass over the tracked repos.
  const updated: Record<string, string> = {};
  for (const repo of cc.commitContributionsByRepository ?? []) {
    const slug = REPO_TO_SLUG[repo.repository?.name];
    if (!slug) continue;
    const pushedAt = repo.repository?.pushedAt;
    if (pushedAt) {
      const iso = String(pushedAt).slice(0, 10);
      if (!updated[slug] || iso > updated[slug]) updated[slug] = iso;
    }
    for (const node of repo.contributions?.nodes ?? []) {
      const date = String(node.occurredAt).slice(0, 10);
      const entry = days[date] ?? (days[date] = { c: 0, r: [] });
      if (!entry.r.includes(slug)) entry.r.push(slug);
    }
  }
  for (const key of Object.keys(days)) days[key].r.sort();

  return {
    endDate: endDate || new Date().toISOString().slice(0, 10),
    maxCount,
    total: cc.contributionCalendar.totalContributions ?? 0,
    days,
    updated,
  };
}

/**
 * The project activity for the page. Deduped per render via React cache (so the page can read both
 * the calendar and the `updated` sort map from one fetch even if rendered concurrently). Wrapped in
 * last-good so a failed fetch serves the previous payload; falls back to an empty calendar.
 */
export const getActivity = cache(async (): Promise<ProjectActivity> => {
  try {
    return (await readThrough<ProjectActivity>('github-activity', fetchActivity)) ?? emptyActivity();
  } catch {
    // No Redis store and the fetch failed (no token, API down, etc.): render an empty calendar.
    return emptyActivity();
  }
});
