#!/usr/bin/env node
/**
 * Regenerates data/project-activity.json — the fallback snapshot for the live
 * GitHub activity calendar (lib/github-activity.ts) and the source of the
 * projects "last updated" sort order.
 *
 * Pulls the full GitHub contribution graph (all activity) plus a per-repo
 * commit breakdown (for day<->card hover linking) via the GraphQL API, using
 * the GitHub CLI for auth. Run from the repo root:
 *
 *   node scripts/sync-project-activity.mjs   (or: npm run sync:projects)
 *
 * The output is a committed snapshot used when no GITHUB_TOKEN is configured;
 * rerun it periodically to refresh it.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const OWNER = 'justmytwospence';

// Maps each project card slug -> the GitHub repo backing it. Keep in sync with
// REPO_TO_SLUG in lib/github-activity.ts. (kcore is a notebook with no repo.)
const PROJECTS = [
  { slug: 'bayesdag', repo: 'bayesDAG' },
  { slug: 'cloudposterior', repo: 'cloudposterior' },
  { slug: 'arviz-mcp', repo: 'arviz-mcp' },
  { slug: 'strava-mcp', repo: 'strava-mcp' },
  { slug: 'ynab-mcp', repo: 'ynab-mcp' },
  { slug: 'hardcover-mcp', repo: 'hardcover-mcp' },
  { slug: 'inoreader-mcp', repo: 'inoreader-mcp' },
  { slug: 'inoreader-obsidian', repo: 'inoreader-obsidian' },
  { slug: 'pacing', repo: 'pacing' },
  { slug: 'swimcue', repo: 'swimcue' },
  { slug: 'homelab', repo: 'homelab' },
  { slug: 'vertfarmer', repo: 'firsttracks' },
  { slug: 'ifs-journal', repo: 'ifs-journal' },
];
const repoToSlug = Object.fromEntries(PROJECTS.map((p) => [p.repo, p.slug]));

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

const QUERY =
  'query($login:String!,$from:DateTime!,$to:DateTime!){' +
  'user(login:$login){contributionsCollection(from:$from,to:$to){' +
  'contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}} ' +
  'commitContributionsByRepository(maxRepositories:100){repository{name} contributions(first:100){nodes{occurredAt commitCount}}}' +
  '}}}';

const to = new Date();
const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

const gql = ghJson([
  'api', 'graphql',
  '-f', `query=${QUERY}`,
  '-f', `login=${OWNER}`,
  '-f', `from=${from.toISOString()}`,
  '-f', `to=${to.toISOString()}`,
]);
const cc = gql.data.user.contributionsCollection;

// Full contribution calendar (all activity) -> per-day counts.
const days = {};
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

// Per-repo commit days -> attribute project slugs for hover linking.
for (const repo of cc.commitContributionsByRepository) {
  const slug = repoToSlug[repo.repository.name];
  if (!slug) continue;
  for (const node of repo.contributions.nodes) {
    const date = String(node.occurredAt).slice(0, 10);
    const entry = days[date] || (days[date] = { c: 0, r: [] });
    if (!entry.r.includes(slug)) entry.r.push(slug);
  }
}

const sortedDays = {};
for (const date of Object.keys(days).sort()) {
  sortedDays[date] = { c: days[date].c, r: days[date].r.sort() };
}

// Last-updated timestamp per project (drives the projects sort order).
const updated = {};
for (const { slug, repo } of PROJECTS) {
  try {
    const meta = ghJson(['api', `repos/${OWNER}/${repo}`, '-H', 'Accept: application/vnd.github+json']);
    updated[slug] = (meta.pushed_at || meta.updated_at || '').slice(0, 10);
  } catch (err) {
    console.error(`! ${repo}: failed to read repo metadata — ${err.message.split('\n')[0]}`);
  }
}

const output = {
  generatedAt: to.toISOString(),
  endDate,
  weeks: 53,
  maxCount,
  total: cc.contributionCalendar.totalContributions,
  updated,
  days: sortedDays,
};

mkdirSync('data', { recursive: true });
writeFileSync('data/project-activity.json', JSON.stringify(output, null, 2) + '\n');
console.log(
  `wrote data/project-activity.json — ${output.total} contributions, max ${maxCount}/day, ` +
    `${Object.keys(sortedDays).length} active days, window ending ${endDate}`
);
