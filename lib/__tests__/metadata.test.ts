import { pageMetadata } from '../metadata';

describe('pageMetadata', () => {
  const meta = pageMetadata({ title: 'Projects', description: 'D', path: '/projects' });

  it('points canonical and og:url at the page', () => {
    expect(meta.alternates?.canonical).toBe('/projects');
    expect(meta.openGraph?.url).toBe('/projects');
  });

  it('restates the site fields the root layout would otherwise supply', () => {
    expect(meta.openGraph).toMatchObject({
      siteName: 'Data Spencer',
      locale: 'en_US',
      type: 'website',
      title: 'Projects — Data Spencer',
      description: 'D',
    });
  });
});
