/**
 * Tests for fiction / non-fiction classification.
 *
 * The concrete book cases below are real shelf entries that the previous tag-only classifier got
 * wrong — every one of them was landing under "Fiction" on /reading because Hardcover exposes no
 * literal "Fiction"/"Nonfiction" tagging for them.
 */

import { describe, it, expect } from 'vitest';
import { classifyIsFiction } from '../src/classify';

const genre = (...tags: string[]) => ({ Genre: tags.map((tag) => ({ tag })) });

describe('classifyIsFiction — literary_type_id (most authoritative)', () => {
  it('treats literary_type_id 1 as fiction', () => {
    expect(classifyIsFiction({ literaryTypeId: 1 })).toBe(true);
  });

  it('treats literary_type_id 2 as non-fiction', () => {
    expect(classifyIsFiction({ literaryTypeId: 2 })).toBe(false);
  });

  it('outranks contradicting genre tags', () => {
    expect(
      classifyIsFiction({ literaryTypeId: 2, cachedTags: genre('Fantasy', 'Science Fiction') }),
    ).toBe(false);
  });
});

describe('classifyIsFiction — genre tag vote', () => {
  it('reads an explicit Nonfiction tag', () => {
    expect(classifyIsFiction({ cachedTags: genre('Nonfiction') })).toBe(false);
  });

  it('does not mistake "Nonfiction" for a "Fiction" substring match', () => {
    expect(classifyIsFiction({ cachedTags: genre('Non-Fiction') })).toBe(false);
    expect(classifyIsFiction({ cachedTags: genre('non fiction') })).toBe(false);
  });

  it('reads compound genres containing "fiction"', () => {
    expect(classifyIsFiction({ cachedTags: genre('Science Fiction & Fantasy') })).toBe(true);
    expect(classifyIsFiction({ cachedTags: genre('Literature & Fiction') })).toBe(true);
    expect(classifyIsFiction({ cachedTags: genre('Argentine fiction') })).toBe(true);
  });

  it('infers fiction from implying genres alone', () => {
    expect(classifyIsFiction({ cachedTags: genre('Fantasy', 'Horror') })).toBe(true);
  });

  it('infers non-fiction from implying genres alone', () => {
    expect(classifyIsFiction({ cachedTags: genre('Biography', 'Mathematics') })).toBe(false);
    expect(classifyIsFiction({ cachedTags: genre('Politics', 'Government') })).toBe(false);
  });

  it('lets an explicit tag outweigh a single implying genre', () => {
    // Historical fiction routinely picks up a "History" tag; the explicit tag must win.
    expect(classifyIsFiction({ cachedTags: genre('History', 'Fiction') })).toBe(true);
  });

  it('ignores tag counts so a bulk-imported category cannot outvote reader tags', () => {
    // "Body, Mind & Spirit" arrives from a BISAC import with counts in the thousands.
    const cachedTags = {
      Genre: [
        { tag: 'Body', count: 1764 },
        { tag: ' Mind & Spirit', count: 1759 },
        { tag: 'Fiction', count: 2 },
      ],
    };
    expect(classifyIsFiction({ cachedTags })).toBe(true);
  });

  it('reads the freeform Tag bucket as well as Genre', () => {
    expect(classifyIsFiction({ cachedTags: { Tag: [{ tag: 'memoir' }] } })).toBe(false);
  });

  it('ignores the Mood bucket, which describes tone rather than form', () => {
    // "informative" leans non-fiction but says nothing definite; without other signal we fall back.
    expect(classifyIsFiction({ cachedTags: { Mood: [{ tag: 'informative' }] } }, false)).toBe(false);
    expect(classifyIsFiction({ cachedTags: { Mood: [{ tag: 'informative' }] } }, true)).toBe(true);
  });

  it('falls through when the vote ties', () => {
    const tied = { cachedTags: genre('Fiction', 'Nonfiction') };
    expect(classifyIsFiction(tied, true)).toBe(true);
    expect(classifyIsFiction(tied, false)).toBe(false);
  });
});

describe('classifyIsFiction — book_category_id', () => {
  it('treats a Short Story as fiction when tags are silent', () => {
    expect(classifyIsFiction({ bookCategoryId: 3 })).toBe(true);
  });

  it('treats a Research Paper as non-fiction', () => {
    expect(classifyIsFiction({ bookCategoryId: 6 })).toBe(false);
  });

  it('does not decide on the generic "Book" category', () => {
    expect(classifyIsFiction({ bookCategoryId: 1 }, false)).toBe(false);
    expect(classifyIsFiction({ bookCategoryId: 1 }, true)).toBe(true);
  });
});

describe('classifyIsFiction — subtitle tiebreak', () => {
  it('reads an explanatory subtitle as non-fiction', () => {
    expect(
      classifyIsFiction({ subtitle: "One Person's Guide to Suicide Prevention" }),
    ).toBe(false);
  });

  it('picks the subtitle out of a colon-joined title when the field is null', () => {
    expect(
      classifyIsFiction({
        title: 'How I Stayed Alive When My Brain Was Trying to Kill Me: A Guide',
        subtitle: null,
      }),
    ).toBe(false);
  });

  it('keeps genre-marker subtitles on the fiction side', () => {
    expect(classifyIsFiction({ subtitle: 'A Novel' })).toBe(true);
    expect(classifyIsFiction({ subtitle: 'And Other Stories' })).toBe(true);
  });

  it('ranks below genre tags', () => {
    expect(
      classifyIsFiction({ subtitle: 'A Novel', cachedTags: genre('Nonfiction') }),
    ).toBe(false);
  });
});

describe('classifyIsFiction — fallback', () => {
  it('uses the fallback when every signal is silent', () => {
    expect(classifyIsFiction({}, true)).toBe(true);
    expect(classifyIsFiction({}, false)).toBe(false);
  });

  it('defaults to fiction', () => {
    expect(classifyIsFiction({})).toBe(true);
  });

  it('tolerates null and malformed tag payloads', () => {
    expect(classifyIsFiction({ cachedTags: null }, false)).toBe(false);
    expect(classifyIsFiction({ cachedTags: { Genre: null } }, false)).toBe(false);
    expect(classifyIsFiction({ cachedTags: { Genre: [{ tag: null }, {}] } }, false)).toBe(false);
  });
});

describe('classifyIsFiction — real shelf regressions', () => {
  const cases: Array<[string, Parameters<typeof classifyIsFiction>[0], boolean]> = [
    [
      'Soul Boom: Why We Need a Spiritual Revolution',
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        subtitle: 'Why We Need a Spiritual Revolution',
        cachedTags: genre('Religions', 'Spirituality', 'Self help', 'Memoir', 'Audiobook', 'Nonfiction', 'Religion', 'Philosophy'),
      },
      false,
    ],
    [
      'Believe: Why Everyone Should Be Religious',
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        subtitle: 'Why Everyone Should Be Religious',
        cachedTags: genre('Philosophy', 'apologetics'),
      },
      false,
    ],
    [
      "Death by Astonishment: Confronting the Mystery of the World's Strangest Drug",
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        subtitle: "Confronting the Mystery of the World's Strangest Drug",
        cachedTags: { Genre: [{ tag: 'Body' }, { tag: ' Mind & Spirit' }] },
      },
      false,
    ],
    [
      'The Man from the Future: The Visionary Life of John von Neumann',
      { literaryTypeId: 2, bookCategoryId: 1, cachedTags: genre('Biography', 'Mathematics') },
      false,
    ],
    [
      'No Bad Parts',
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        cachedTags: { Genre: [{ tag: 'Psychology' }, { tag: 'Nonfiction' }, { tag: 'Self-Help' }], Tag: [{ tag: 'psychology' }, { tag: 'memoir' }] },
      },
      false,
    ],
    [
      'Transcription',
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        subtitle: 'A Novel',
        cachedTags: { Genre: [{ tag: 'Fiction' }, { tag: 'Literary Fiction' }, { tag: 'Novella' }] },
      },
      true,
    ],
    [
      'Harrison Bergeron',
      {
        literaryTypeId: null,
        bookCategoryId: 1,
        cachedTags: genre('Classics', 'Fiction', 'Science Fiction', 'Dystopian', 'Short stories'),
      },
      true,
    ],
    [
      'Solaris',
      { literaryTypeId: 1, bookCategoryId: 1, cachedTags: genre('Science Fiction', 'Fiction') },
      true,
    ],
  ];

  it.each(cases)('%s', (_title, input, expected) => {
    expect(classifyIsFiction(input)).toBe(expected);
  });
});
