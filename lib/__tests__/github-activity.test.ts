import { vi } from 'vitest';
import { getAllProjects, getTopLevelProjects } from '../content';
import { getActivity, REPO_TO_SLUG, rollUpProjectActivity, type ProjectActivity } from '../github-activity';
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
  'claude-auto-effort', 'opencode-auto-effort', 'claude-cache-guard', 'opencode-cache-guard',
  'codex-cache-guard', 'claude-marimo', 'opencode-marimo', 'opencode-next-prompt',
  'opencode-tool-gate', 'pi-lean-context', 'opencode-lean-context',
  'opencode-herdr', 'opencode-prose-width', 'claude-prose-width',
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
    const visible = new Set(getTopLevelProjects().map(project => project.slug));
    for (const slug of Object.values(REPO_TO_SLUG)) expect(visible.has(slug)).toBe(true);
    for (const repo of ['tmux-agents', 'herdr-machine0', 'herdr-repeat-navigation', 'anthropic-billing-guard']) {
      expect(REPO_TO_SLUG[repo]).toBe(repo);
    }
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
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.mocked(readThrough).mockImplementation(async (_key, fetcher) => fetcher());
    const repo = (name: string, pushedAt: string) => ({
      repository: { name, pushedAt },
      contributions: { nodes: [{ occurredAt: '2026-10-09T12:00:00Z', commitCount: 1 }] },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { contributionsCollection: {
        contributionCalendar: { totalContributions: 12, weeks: [{ contributionDays: [
          { date: '2026-10-09', contributionCount: 12 },
        ] }] },
        commitContributionsByRepository: [
          repo('pi-plugins', '2026-10-08T00:00:00Z'),
          repo('pi-bg', '2026-10-09T00:00:00Z'),
          repo('opencode-cache-guard', '2026-10-10T00:00:00Z'),
          repo('tmux-agents', '2026-10-07T00:00:00Z'),
          repo('unlisted-repo', '2026-10-11T00:00:00Z'),
        ],
      } } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getActivity();
    expect(result.days['2026-10-09']).toEqual({ c: 12, r: ['pi-plugins', 'tmux-agents'] });
    expect(result.updated).toEqual({ 'pi-plugins': '2026-10-10', 'tmux-agents': '2026-10-07' });
    expect(result.total).toBe(12);
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/graphql', expect.objectContaining({
      next: { revalidate: 3600 },
    }));
  });

  it('retains the empty fallback when both live data and last-good are unavailable', async () => {
    vi.mocked(readThrough).mockRejectedValue(new Error('offline'));
    expect(await getActivity()).toMatchObject({ total: 0, days: {}, updated: {} });
  });
});
