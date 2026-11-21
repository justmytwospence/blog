import config from '../../next.config.mjs';
import { getProjectBySlug } from '../content';

describe('project redirects', () => {
  it('sends retired project slugs somewhere that exists', async () => {
    const redirects = await config.redirects();
    expect(redirects.length).toBeGreaterThan(0);
    for (const { source, destination } of redirects) {
      expect(getProjectBySlug(source.replace('/projects/', '')), source).toBeNull();
      if (destination !== '/projects') {
        expect(getProjectBySlug(destination.replace('/projects/', '')), destination).not.toBeNull();
      }
    }
  });
});
