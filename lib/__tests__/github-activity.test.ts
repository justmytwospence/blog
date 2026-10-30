import { vi } from 'vitest';
import { getAllProjects, getTopLevelProjects } from '../content';
import { activityWindow, getActivity, projectSparklines, REPO_TO_SLUG, rollUpProjectActivity, type ProjectActivity } from '../github-activity';
import { readThrough } from '../last-good';
import projectNames from '../project-names';

vi.mock('../last-good', () => ({ readThrough: vi.fn() }));

// Snapshot of the suite's source-pins.json names; tests must not depend on a sibling checkout.
const components = [
  'pi-ask-user-question', 'pi-plan-mode', 'pi-status-footer', 'pi-rewind', 'pi-clear-screen',
  'pi-select-nav', 'pi-herdr-scrollbar-width', 'pi-herdr', 'pi-subagents', 'pi-tool-gate',
  'pi-bg', 'pi-auto-effort', 'pi-appearance-resync', 'pi-copy', 'pi-marimo', 'pi-cache-guard',
  'pi-next-prompt', 'pi-diff-review', 'pi-prose-width',
];
const ports = [
  'claude-auto-effort', 'claude-cache-guard', 'codex-cache-guard', 'claude-marimo',
  'pi-lean-context', 'claude-prose-width', 'claude-tool-gate',
];
// Retired standalone OpenCode ports retain attribution to the Pi Plugins collection.
const opencodePorts = [
  'opencode-auto-effort', 'opencode-cache-guard', 'opencode-marimo', 'opencode-next-prompt',
  'opencode-tool-gate', 'opencode-lean-context', 'opencode-herdr', 'opencode-prose-width',
  'opencode-git-status',
];

const oldActivity: ProjectActivity = {
  endDate: '2026-10-10', maxCount: 12, total: 21,
  days: {
    '2026-10-09': { c: 12, r: ['cache-guard', 'pi-plugins', 'pi-copy', 'tmux-agents'] },
    '2026-10-10': { c: 9, r: ['auto-effort', 'lean-context'] },
  },
  updated: { 'pi-plugins': '2026-10-08', 'cache-guard': '2026-10-10', 'pi-copy': '2026-10-09', 'tmux-agents': '2026-10-07' },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(readThrough).mockReset();
});

describe('portfolio activity rollup', () => {
  it('tracks the suite, all 19 components, retired predecessors, and feature ports as one visible card', () => {
    expect(components).toHaveLength(19);
    for (const repo of ['pi-plugins', ...components, ...ports]) {
      expect(REPO_TO_SLUG[repo]).toBe('pi-plugins');
    }
    expect(projectNames['pi-plugins']).toBe('Pi Plugins');
    expect(opencodePorts).toHaveLength(9);
    for (const repo of ['opencode-plugins', ...opencodePorts]) {
      expect(REPO_TO_SLUG[repo]).toBe('pi-plugins');
    }
    expect(projectNames['opencode-plugins']).toBeUndefined();
    const visible = new Set(getTopLevelProjects().map(project => project.slug));
    for (const slug of Object.values(REPO_TO_SLUG)) expect(visible.has(slug)).toBe(true);
    for (const repo of ['tmux-agents', 'herdr-machine0', 'herdr-repeat-navigation', 'anthropic-billing-guard', 'pi-brokered-auth', 'aac-touchid', 'agent-scrub', 'herdr-agentbox', 'herdr-undo', 'herdr-git-status']) {
      expect(REPO_TO_SLUG[repo]).toBe(repo);
    }
  });

  it('names every project card, collection children included', () => {
    const unnamed = getAllProjects().map(project => project.slug).filter(slug => !projectNames[slug]);
    expect(unnamed).toEqual([]);
  });

  it('normalizes old cached hover slugs and dates without changing totals or mutating the payload', () => {
    const before = structuredClone(oldActivity);
    const rolled = rollUpProjectActivity(oldActivity, getAllProjects());
    expect(rolled.days['2026-10-09']).toEqual({ c: 12, r: ['pi-plugins', 'tmux-agents'] });
    expect(rolled.days['2026-10-10']).toEqual({ c: 9, r: ['pi-plugins'] });
    expect(rolled.updated).toEqual({ 'pi-plugins': '2026-10-10', 'tmux-agents': '2026-10-07' });
    expect(rolled).toMatchObject({ total: 21, maxCount: 12, endDate: '2026-10-10' });
    expect(oldActivity).toEqual(before);
  });

  it('applies the rollup to last-good responses, not only fresh fetches', async () => {
    vi.mocked(readThrough).mockResolvedValue(oldActivity);
    const result = await getActivity();
    expect(result.days['2026-10-10'].r).toEqual(['pi-plugins']);
    expect(result.updated['pi-plugins']).toBe('2026-10-10');
  });

  it('deduplicates fresh suite/legacy commit days and sorts by their latest push', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T18:00:00Z'));
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.mocked(readThrough).mockImplementation(async (_key, fetcher) => fetcher());
    const repo = (name: string, pushedAt: string, date = '2026-10-09', isPrivate = false) => ({
      repository: { name, pushedAt, isPrivate },
      contributions: { nodes: [{ occurredAt: `${date}T12:00:00Z`, commitCount: 1 }] },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: {
        calendar: { contributionCalendar: { totalContributions: 99, weeks: [{ contributionDays: [
          { date: '2025-10-25', contributionCount: 40 }, // a day before the 365-day window
          { date: '2025-11-02', contributionCount: 3 },
          { date: '2026-10-09', contributionCount: 12 },
          { date: '2026-10-20', contributionCount: 5 }, // private work only
          { date: '2026-10-21', contributionCount: 2 }, // private repo without a card
        ] }] } },
        s0: { commitContributionsByRepository: [repo('swimcue', '2025-11-02T00:00:00Z', '2025-11-02')] },
        s1: { commitContributionsByRepository: [] },
        s2: { commitContributionsByRepository: [] },
        s3: { commitContributionsByRepository: [
          repo('pi-plugins', '2026-10-08T00:00:00Z'),
          repo('pi-bg', '2026-10-09T00:00:00Z'),
          repo('claude-cache-guard', '2026-10-10T00:00:00Z'),
          repo('tmux-agents', '2026-10-07T00:00:00Z'),
          repo('unlisted-repo', '2026-10-11T00:00:00Z'),
          repo('homelab', '2026-10-20T00:00:00Z', '2026-10-20', true), // private with a card: named
          repo('secret-repo', '2026-10-21T00:00:00Z', '2026-10-21', true), // private, no card: a number
        ] },
      } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getActivity();
    vi.useRealTimers();
    expect(result.startDate).toBe('2025-10-26');
    expect(result.endDate).toBe('2026-10-25');
    expect(result.days['2025-10-25']).toBeUndefined();
    expect(result.days['2025-11-02']).toEqual({ c: 3, r: ['swimcue'] });
    expect(result.days['2026-10-09']).toEqual({ c: 12, r: ['pi-plugins', 'tmux-agents'] });
    expect(result.days['2026-10-20']).toEqual({ c: 5, r: ['homelab'] });
    expect(result.days['2026-10-21']).toEqual({ c: 2, r: [] });
    expect(result.updated).toEqual({
      'pi-plugins': '2026-10-10', 'tmux-agents': '2026-10-07', swimcue: '2025-11-02', homelab: '2026-10-20',
    });
    expect(result.total).toBe(22);
    // Suite repos sum into the visible card; private repos with a card count; unlisted repos never get a series.
    expect(result.commits).toEqual({
      swimcue: { '2025-11-02': 1 },
      'pi-plugins': { '2026-10-09': 3 },
      'tmux-agents': { '2026-10-09': 1 },
      homelab: { '2026-10-20': 1 },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/graphql', expect.objectContaining({
      next: { revalidate: 3600 },
    }));
  });

  it('covers exactly 365 days in contiguous slices short enough for one page of commit days', () => {
    const { start, end, slices } = activityWindow(new Date('2026-10-25T18:00:00Z'));
    const day = 24 * 60 * 60 * 1000;
    expect((end.getTime() - start.getTime()) / day + 1).toBe(365);
    expect(slices[0][0]).toEqual(start);
    for (let i = 1; i < slices.length; i++) expect(slices[i][0].getTime()).toBe(slices[i - 1][1].getTime() + 1);
    expect(slices.at(-1)![1].getTime()).toBe(end.getTime() + day - 1);
    for (const [from, to] of slices) expect((to.getTime() + 1 - from.getTime()) / day).toBeLessThanOrEqual(100);
  });

  it('retains the empty fallback when both live data and last-good are unavailable', async () => {
    vi.mocked(readThrough).mockRejectedValue(new Error('offline'));
    expect(await getActivity()).toMatchObject({ total: 0, days: {}, updated: {} });
  });
});

describe('project sparklines', () => {
  const base = { startDate: '2025-10-26', endDate: '2026-10-25', maxCount: 0, total: 0, updated: {} };

  it('buckets commits into the calendar\'s Sunday-to-Saturday weeks', () => {
    const series = projectSparklines({
      ...base,
      days: {},
      commits: {
        // 2025-10-26 is a Sunday, so it opens week 0; 2026-10-25 (also a Sunday) opens the last.
        swimcue: { '2025-10-26': 2, '2025-11-01': 3, '2025-11-02': 4, '2026-10-25': 1 },
        dormant: { '2024-01-01': 5 },
      },
    });
    expect(series.swimcue.period).toBe('year');
    expect(series.swimcue.points).toHaveLength(53);
    expect(series.swimcue.points.slice(0, 2)).toEqual([5, 4]);
    expect(series.swimcue.points.at(-1)).toBe(1);
    expect(series.dormant).toBeUndefined();
  });

  it('counts active days for last-good payloads without commit counts', () => {
    const series = projectSparklines({
      ...base,
      days: { '2025-10-27': { c: 9, r: ['pacing'] }, '2025-10-28': { c: 1, r: ['pacing'] } },
    });
    expect(series.pacing.points[0]).toBe(2);
  });

  it('uses 30 daily bins for projects younger than 60 days and clips older days', () => {
    const series = projectSparklines({ ...base, days: {}, commits: {
      young: { '2026-08-27': 5, '2026-09-26': 2, '2026-10-25': 3, '2026-10-26': 9 },
      old: { '2026-08-26': 1, '2026-10-25': 2 },
    } });
    expect(series.young.period).toBe('month');
    expect(series.young.points).toHaveLength(30);
    expect(series.young.points[0]).toBe(2);
    expect(series.young.points.at(-1)).toBe(3);
    expect(series.young.points.reduce((a, b) => a + b, 0)).toBe(5);
    expect(series.old.period).toBe('year');
  });

  it('uses historical age for a returning project and ignores future-only activity', () => {
    const series = projectSparklines({ ...base, days: {}, commits: {
      returning: { '2026-10-25': 4 }, future: { '2026-10-26': 9 },
    } }, { returning: { '2020-01-05': 1 }, future: { '2026-11-01': 2 } });
    expect(series.returning.period).toBe('year');
    expect(series.returning.points.at(-1)).toBe(4);
    expect(series.future).toBeUndefined();
  });
});
