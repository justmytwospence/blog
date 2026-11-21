import { isNavActive } from '../nav';

describe('isNavActive', () => {
  it('matches a section and its children', () => {
    expect(isNavActive('/blog', '/blog')).toBe(true);
    expect(isNavActive('/blog/kcore', '/blog')).toBe(true);
    expect(isNavActive('/adventures/objectives/races', '/adventures')).toBe(true);
  });

  it('does not match a sibling that shares a prefix', () => {
    expect(isNavActive('/blogroll', '/blog')).toBe(false);
    expect(isNavActive('/blogroll', '/blogroll')).toBe(true);
  });

  it('matches home only at the root', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/about', '/')).toBe(false);
  });
});
