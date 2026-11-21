import { getAllProjects, getProjectBySlug } from '../content';

const deadOrPrivate = /github\.com\/justmytwospence\/(?:herdr-machine0|herdr-repeat-navigation|anthropic-billing-guard|herdr-agentbox|herdr-git-status|herdr-undo|effort-cubes|effort-curves|firsttracks|groundcover|ifs-journal|homelab|pacing|pi-plugins\/tree\/main\/packages\/pi-(?:auto-effort|marimo))(?:[/?#)\s"'\\]|$)/;

describe('project links', () => {
  it('links to no deleted, archived or private repository', () => {
    for (const project of getAllProjects()) {
      expect(JSON.stringify(getProjectBySlug(project.slug)), project.slug).not.toMatch(deadOrPrivate);
    }
  });

  it('keeps private-source projects free of repository links', () => {
    const privateProjects = getAllProjects().filter(project => project.sourcePrivate);
    expect(privateProjects.length).toBeGreaterThan(0);
    for (const project of privateProjects) {
      const urls = [project.externalUrl, ...(project.links ?? []).map(link => link.url)];
      expect(urls.some(url => url?.includes('github.com/justmytwospence')), project.slug).toBe(false);
    }
  });

  it('resolves every internal project link', () => {
    for (const project of getAllProjects()) {
      const content = getProjectBySlug(project.slug);
      const body = content && 'content' in content ? content.content ?? '' : '';
      for (const [, slug] of body.matchAll(/\]\(\/projects\/([a-z0-9-]+)\)/g)) {
        expect(getProjectBySlug(slug), `${project.slug} -> ${slug}`).not.toBeNull();
      }
    }
  });
});
