import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { describe, it, expect } from 'vitest';
import { validateObjectiveFrontmatter, parseObjective, OBJECTIVE_PAGES } from '../objective-schema';
import { isCompanionFile } from '../adventure-schema';

const base = { title: 'Mount Elbert', page: 'peaks', sections: ['14ers'] };
const v = (extra: Record<string, unknown>) => validateObjectiveFrontmatter({ ...base, ...extra }, 'x.md');

describe('validateObjectiveFrontmatter', () => {
  it('accepts a minimal valid file', () => {
    expect(validateObjectiveFrontmatter(base, 'x.md')).toEqual([]);
  });

  it('flags unknown keys (private-plan fields must not sneak back in)', () => {
    const errs = v({ horizon: 'next' });
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('unknown key `horizon`');
  });

  it('rejects an unknown or missing page', () => {
    expect(v({ page: 'hiking' })).toContain('x.md: invalid page `hiking`');
    expect(validateObjectiveFrontmatter({ title: 'T', sections: ['14ers'] }, 'x.md')).toContain('x.md: missing page');
  });

  it('checks sections against the page', () => {
    expect(v({ sections: ['skimo'] })).toContain('x.md: invalid section `skimo` for page `peaks`');
    expect(v({ sections: [] })).toContain('x.md: missing sections');
  });

  it('requires lat and lng together and in range', () => {
    expect(v({ lat: 40 })).toContain('x.md: lat and lng must be set together');
    expect(v({ lat: 95, lng: 10 })).toContain('x.md: invalid lat `95`');
    expect(v({ lat: 40, lng: -105 })).toEqual([]);
  });

  it('checks link and numeric fields', () => {
    expect(v({ link: 'http://x' })).toContain('x.md: link must be https');
    expect(v({ elevation_ft: -3 })).toContain('x.md: invalid elevation_ft `-3`');
  });
});

describe('wikidata, links and route specs', () => {
  it('checks wikidata and links', () => {
    expect(v({ wikidata: 'Q1' })).toEqual([]);
    expect(v({ wikidata: 'x1' })).toContain('x.md: invalid wikidata `x1`');
    expect(v({ links: [{ label: 'A', url: 'http://a' }] })).toContain('x.md: invalid links');
    expect(v({ links: [{ label: 'A', url: 'https://a.com' }] })).toEqual([]);
  });

  it('accepts valid route specs', () => {
    const via = [[1, 2], [3, 4]];
    expect(v({ route: { kind: 'brouter', profile: 'hiking-mountain', via, out_and_back: true } })).toEqual([]);
    expect(v({ route: { kind: 'osm', relations: [123], start: [1, 2] } })).toEqual([]);
    expect(v({ route: { kind: 'line', via } })).toEqual([]);
    expect(v({ route: { kind: 'none' } })).toEqual([]);
  });

  it('rejects bad route specs', () => {
    const via = [[1, 2], [3, 4]];
    expect(v({ route: { kind: 'brouter', profile: 'car', via } }).join()).toContain('invalid route');
    expect(v({ route: { kind: 'line', via: [[1, 2]] } }).join()).toContain('invalid route');
    expect(v({ route: { kind: 'line', via, bogus: 1 } }).join()).toContain('invalid route');
  });
});

describe('parseObjective', () => {
  it('maps fields', () => {
    const o = parseObjective(
      'mount-elbert',
      { ...base, distance_mi: 4.7, gain_ft: 4508, elevation_ft: 14440, completed_by: 'mount-elbert' },
      'Colorado high point.\n',
    );
    expect(o).toMatchObject({
      slug: 'mount-elbert',
      distanceMi: 4.7,
      gainFt: 4508,
      elevationFt: 14440,
      completedBy: 'mount-elbert',
      description: 'Colorado high point.',
    });
  });

  it('applies defaults', () => {
    const o = parseObjective('x', base, '  \n');
    expect(o).toMatchObject({ season: [], multiSport: false, completed: false, description: null, lat: null, link: null });
  });
});

describe('real content/objectives', () => {
  const dir = path.join(process.cwd(), 'content', 'objectives');
  const files = fs.readdirSync(dir).filter(isCompanionFile);
  const parsed = files.map((f) => ({ f, ...matter(fs.readFileSync(path.join(dir, f), 'utf8')) }));

  it('every file validates, and there are 292', () => {
    expect(files).toHaveLength(292);
    const errs = parsed.flatMap((p) => validateObjectiveFrontmatter(p.data, p.f));
    expect(errs).toEqual([]);
  });

  it('every section of every page has at least one item', () => {
    for (const page of OBJECTIVE_PAGES) {
      for (const s of page.sections) {
        const n = parsed.filter((p) => p.data.page === page.id && (p.data.sections as string[]).includes(s.id)).length;
        expect(n, `${page.id}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });
});
