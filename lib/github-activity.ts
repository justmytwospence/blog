import type { ActivityData } from '@/components/ContributionCalendar';
import fallback from '@/data/project-activity.json';

/**
 * Fetches the GitHub contribution graph (ALL activity, including private
 * contribution counts) live at runtime, plus a per-repo commit breakdown used
 * to link calendar days to project cards. Requires a GITHUB_TOKEN (or GH_TOKEN)
 * env var; without one — or on any error — it falls back to the committed
 * snapshot in data/project-activity.json so the page still renders.
 */

const OWNER = 'justmytwospence';

// GitHub repo name -> project card slug. Keep in sync with the PROJECTS list in
// scripts/sync-project-activity.mjs. Repos not listed here still count toward
// the calendar total but don't link to a card.
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
        repository{ name }
        contributions(first:100){ nodes{ occurredAt commitCount } }
      }
    }
  }
}`;

function snapshotFallback(): ActivityData {
  const f = fallback as unknown as {
    endDate: string;
    maxCount: number;
    total?: number;
    totalCommits?: number;
    days: Record<string, { c: number; r: string[] }>;
  };
  return { endDate: f.endDate, maxCount: f.maxCount, total: f.total ?? f.totalCommits ?? 0, days: f.days };
}

export async function getActivity(): Promise<ActivityData> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return snapshotFallback();

  try {
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
      // Cache the upstream response so the page can revalidate without a redeploy.
      next: { revalidate: 3600 },
    });

    if (!res.ok) return snapshotFallback();
    const json = await res.json();
    const cc = json?.data?.user?.contributionsCollection;
    if (!cc?.contributionCalendar) return snapshotFallback();

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

    // Attribute each project's commit days so day<->card hover linking still works.
    for (const repo of cc.commitContributionsByRepository ?? []) {
      const slug = REPO_TO_SLUG[repo.repository?.name];
      if (!slug) continue;
      for (const node of repo.contributions?.nodes ?? []) {
        const date = String(node.occurredAt).slice(0, 10);
        const entry = days[date] ?? (days[date] = { c: 0, r: [] });
        if (!entry.r.includes(slug)) entry.r.push(slug);
      }
    }
    for (const key of Object.keys(days)) days[key].r.sort();

    return {
      endDate: endDate || snapshotFallback().endDate,
      maxCount,
      total: cc.contributionCalendar.totalContributions ?? 0,
      days,
    };
  } catch {
    return snapshotFallback();
  }
}
