#!/usr/bin/env node
/**
 * Regenerates data/project-activity.json — the data behind the projects page's
 * GitHub-style contribution calendar and the "last updated" sort order.
 *
 * Shells out to the GitHub CLI (`gh`), so it uses your existing auth and can
 * read private repos (e.g. homelab). Run from the repo root:
 *
 *   node scripts/sync-project-activity.mjs   (or: npm run sync:projects)
 *
 * The output is a committed snapshot; rerun it periodically to refresh.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const OWNER = 'justmytwospence';

// Maps each project card slug -> the GitHub repo backing it.
// (kcore is a notebook with no repo; it falls back to its frontmatter date.)
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

const DAY = 86400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ghJson(apiPath) {
  const out = execFileSync('gh', ['api', apiPath, '-H', 'Accept: application/vnd.github+json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function isoDay(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

const dayCounts = new Map(); // 'YYYY-MM-DD' -> { c: number, r: Set<slug> }
const updated = {};
let latestWeek = 0;

for (const { slug, repo } of PROJECTS) {
  // Last-updated timestamp (drives the projects sort order).
  try {
    const meta = ghJson(`repos/${OWNER}/${repo}`);
    updated[slug] = (meta.pushed_at || meta.updated_at || '').slice(0, 10);
  } catch (err) {
    console.error(`! ${repo}: failed to read repo metadata — ${err.message.split('\n')[0]}`);
  }

  // Weekly commit activity for the last 52 weeks. GitHub returns 202 while it
  // computes stats the first time, so retry a few times.
  let weeks = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = ghJson(`repos/${OWNER}/${repo}/stats/commit_activity`);
      if (Array.isArray(res) && res.length > 0) {
        weeks = res;
        break;
      }
    } catch {
      // empty body / 202 / transient — retry
    }
    await sleep(2000);
  }
  if (!weeks) {
    console.error(`! ${repo}: no commit_activity returned (skipped)`);
    continue;
  }

  let repoTotal = 0;
  for (const w of weeks) {
    latestWeek = Math.max(latestWeek, w.week);
    for (let d = 0; d < 7; d++) {
      const n = w.days[d];
      if (!n) continue;
      const date = isoDay(w.week + d * DAY);
      let entry = dayCounts.get(date);
      if (!entry) {
        entry = { c: 0, r: new Set() };
        dayCounts.set(date, entry);
      }
      entry.c += n;
      entry.r.add(slug);
      repoTotal += n;
    }
  }
  console.log(`  ${repo}: ${repoTotal} commits/52wk, updated ${updated[slug] || '?'}`);
}

const days = {};
const activeRepos = new Set();
let maxCount = 0;
let totalCommits = 0;
for (const [date, entry] of [...dayCounts.entries()].sort()) {
  days[date] = { c: entry.c, r: [...entry.r].sort() };
  for (const slug of entry.r) activeRepos.add(slug);
  maxCount = Math.max(maxCount, entry.c);
  totalCommits += entry.c;
}

const endDate = latestWeek
  ? isoDay(latestWeek + 6 * DAY)
  : new Date().toISOString().slice(0, 10);

const output = {
  generatedAt: new Date().toISOString(),
  endDate,
  weeks: 53,
  maxCount,
  totalCommits,
  repoCount: activeRepos.size,
  updated,
  days,
};

mkdirSync('data', { recursive: true });
writeFileSync('data/project-activity.json', JSON.stringify(output, null, 2) + '\n');
console.log(
  `\nwrote data/project-activity.json — ${totalCommits} commits, max ${maxCount}/day, ` +
    `${Object.keys(days).length} active days, window ending ${endDate}`
);
