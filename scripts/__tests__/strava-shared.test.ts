import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify, readCompanions, listCompanionFiles, CONTENT_DIR } from '../strava-shared';

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FIXTURES = path.join(FIXTURE_ROOT, 'companions');
const MALFORMED = path.join(FIXTURE_ROOT, 'malformed');

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Mount Elbert')).toBe('mount-elbert');
  });

  it('strips punctuation', () => {
    expect(slugify('Mt. Elbert')).toBe('mt-elbert');
    expect(slugify("Phil's Trail")).toBe('phils-trail');
  });

  it('strips diacritics via NFKD', () => {
    expect(slugify('Café Ridge')).toBe('cafe-ridge');
  });

  it('collapses whitespace, underscores and repeated dashes', () => {
    expect(slugify('a   b')).toBe('a-b');
    expect(slugify('a___b')).toBe('a-b');
    expect(slugify('a---b')).toBe('a-b');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Bear Peak--  ')).toBe('bear-peak');
  });

  it('falls back to "activity" when nothing survives', () => {
    expect(slugify('!!!')).toBe('activity');
    expect(slugify('')).toBe('activity');
  });

  it('handles the arrow names Strava activities often use', () => {
    expect(slugify('Big Eddy → Benham Falls')).toBe('big-eddy-benham-falls');
  });
});

describe('listCompanionFiles', () => {
  it('returns only .md files, sorted, skipping dotfiles and non-markdown', () => {
    // The dir also holds notes.txt and ._applesingle.md, both of which must be filtered out.
    expect(listCompanionFiles(FIXTURES)).toEqual([
      'hidden-lap.md',
      'manual.md',
      'multi-day.md',
      'simple.md',
    ]);
  });

  it('returns empty for a missing directory', () => {
    expect(listCompanionFiles(path.join(FIXTURES, 'nope'))).toEqual([]);
  });
});

describe('readCompanions', () => {
  it('parses ids, group, laps, hidden and source', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const comps = readCompanions(undefined, FIXTURES);
    warn.mockRestore();

    const by = (slug: string) => comps.find((c) => c.slug === slug);

    expect(by('simple')).toMatchObject({ ids: [111], hidden: false, source: null, group: null, laps: false });
    expect(by('multi-day')?.ids).toEqual([222, 333]);
    expect(by('hidden-lap')).toMatchObject({ ids: [444], hidden: true, group: 'eldora-morning', laps: true });
    // The `source:` contract the deleted importers left behind — sync keeps these but never fetches.
    expect(by('manual')).toMatchObject({ ids: [10003], source: '14ers' });
  });

  it('logs a malformed companion and keeps reading the rest', () => {
    // Its own fixture dir on purpose: gray-matter caches by content, so a file another test has
    // already parsed behaves differently on a second read, making this order-dependent otherwise.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const comps = readCompanions(undefined, MALFORMED);
    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0]?.[0])).toContain('broken-yaml.md');
    err.mockRestore();
    // The malformed file is dropped; its intact sibling still comes back.
    expect(comps.map((c) => c.slug)).toEqual(['intact']);
  });

  it('accepts an injected matter function', () => {
    const fake = vi.fn(() => ({ data: { strava_id: 7 } }));
    const comps = readCompanions(fake, FIXTURES);
    expect(fake).toHaveBeenCalled();
    expect(comps.every((c) => c.ids[0] === 7)).toBe(true);
  });
});

describe('real content invariants', () => {
  it('reads every companion file in the content tree', () => {
    // CONTENT_DIR resolves off import.meta.url, so this holds regardless of cwd.
    expect(readCompanions().length).toBe(listCompanionFiles(CONTENT_DIR).length);
  });

  it('still carries the source-flagged manual imports', () => {
    // The three importer scripts were deleted; the data contract they wrote must survive.
    expect(readCompanions().filter((c) => c.source).length).toBeGreaterThanOrEqual(39);
  });
});
