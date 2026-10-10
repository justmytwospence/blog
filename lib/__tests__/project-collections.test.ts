import { getAllProjects, getFeaturedContent, getProjectBySlug, getTopLevelProjects } from '../content';
import { projectCardDestination } from '../project-navigation';
import { generateFeed } from '../feed';
import sitemap from '@/app/sitemap';

const childSlugs = [
  'auto-effort', 'cache-guard', 'marimo-for-agents', 'next-prompt', 'tool-gate', 'lean-context', 'pi-brokered-auth',
  'pi-ask-user-question', 'pi-plan-mode', 'pi-status-footer', 'pi-rewind', 'pi-clear-screen',
  'pi-select-nav', 'pi-herdr-scrollbar-width', 'pi-subagents', 'pi-appearance-resync', 'pi-copy',
];
const separateSlugs = [
  'anthropic-billing-guard', 'tmux-agents', 'herdr-repeat-navigation',
  'herdr-machine0', 'paseo-machine0', 'homelab',
];

describe('Pi Plugins portfolio collection', () => {
  it('keeps an internal, featured overview with independently accessible resource links', () => {
    const overview = getProjectBySlug('pi-plugins')!;
    expect(overview.type).toBe('markdown');
    expect(overview.metadata).toMatchObject({ title: 'Pi Plugins', collection: true, featured: true });
    expect(overview.metadata.externalUrl).toBeUndefined();
    expect(overview.metadata.links?.map(link => link.url)).toEqual(expect.arrayContaining([
      'https://pi-plugins.vercel.app', 'https://github.com/justmytwospence/pi-plugins',
    ]));
    const featured = getFeaturedContent().projects;
    expect(featured.filter(project => project.slug === 'pi-plugins')).toHaveLength(1);
    expect(featured.every(project => !project.parent)).toBe(true);
  });

  it('folds children out of listings without removing their detail metadata or sitemap URLs', () => {
    const all = getAllProjects();
    const visible = getTopLevelProjects();
    const urls = sitemap().map(entry => entry.url);
    expect(visible.filter(project => project.slug === 'pi-plugins')).toHaveLength(1);
    for (const slug of childSlugs) {
      const child = all.find(project => project.slug === slug)!;
      const detail = getProjectBySlug(slug)!;
      expect(child.parent).toBe('pi-plugins');
      expect(detail.metadata.parent).toBe(child.parent);
      expect(detail.metadata.links).toEqual(child.links);
      expect(visible.some(project => project.slug === slug)).toBe(false);
      expect(urls.some(url => url.endsWith(`/projects/${slug}`))).toBe(true);
    }
    for (const slug of separateSlugs) {
      expect(visible.some(project => project.slug === slug)).toBe(true);
    }
  });

  it('marks lean-context as retired and directs readers to cache-guard', () => {
    const retired = getProjectBySlug('lean-context')!;
    expect(retired.metadata.description).toMatch(/retired/i);
    if (retired.type !== 'link') throw new Error('Expected the retained legacy link page');
    expect(retired.content).toContain('[cache-guard](/projects/cache-guard)');
  });

  it('preserves ports on feature detail pages', () => {
    for (const slug of ['auto-effort', 'cache-guard', 'marimo-for-agents', 'next-prompt', 'tool-gate', 'lean-context']) {
      const links = getProjectBySlug(slug)!.metadata.links!;
      expect(links.some(link => link.url.includes('/opencode-'))).toBe(true);
    }
    expect(getProjectBySlug('cache-guard')!.metadata.links?.map(link => link.label))
      .toEqual(['pi', 'Claude Code', 'opencode', 'Codex']);
  });

  it('uses rolled-up recency for the visible overview', () => {
    expect(getTopLevelProjects({ 'pi-plugins': '2999-12-31' })[0].slug).toBe('pi-plugins');
  });

  it('publishes one collection story in the feed while keeping unrelated projects', async () => {
    const feed = await generateFeed();
    const urls = feed.items.map(item => item.link);
    expect(urls.filter(url => url.endsWith('/projects/pi-plugins'))).toHaveLength(1);
    for (const slug of childSlugs) {
      expect(urls.some(url => url.endsWith(`/projects/${slug}`))).toBe(false);
    }
    expect(urls.some(url => url.endsWith('/projects/tmux-agents'))).toBe(true);
  });
});

describe('project card destinations', () => {
  it('opens the collection internally, without changing existing external card behavior', () => {
    const all = getAllProjects();
    expect(projectCardDestination(all.find(project => project.slug === 'pi-plugins')!))
      .toEqual({ href: '/projects/pi-plugins', external: false });
    for (const project of all.filter(project => !project.collection)) {
      const external = project.links?.[0]?.url ?? project.externalUrl;
      expect(projectCardDestination(project)).toEqual({
        href: external ?? `/projects/${project.slug}`, external: Boolean(external),
      });
    }
  });
});
