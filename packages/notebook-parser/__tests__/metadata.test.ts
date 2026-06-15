/**
 * Tests for Quarto metadata extraction
 */

import {
  extractMetadata,
  parseQuartoFrontmatter,
  getDefaultMetadata,
} from '../src/metadata';
import { Notebook, NotebookCell } from '../src/types';

function rawCell(source: string | string[]): NotebookCell {
  return { cell_type: 'raw', source, metadata: {} };
}

function notebookWith(cells: NotebookCell[]): Notebook {
  return { nbformat: 4, nbformat_minor: 5, metadata: {}, cells };
}

const FULL_FRONTMATTER = [
  '---\n',
  'title: "My Notebook"\n',
  'date: "2025-01-15"\n',
  'description: "A test notebook"\n',
  'categories: ["python", "stats"]\n',
  'featured: true\n',
  '---\n',
];

describe('parseQuartoFrontmatter', () => {
  it('parses full frontmatter from an array-source raw cell', () => {
    const result = parseQuartoFrontmatter(rawCell(FULL_FRONTMATTER));
    expect(result).toEqual({
      title: 'My Notebook',
      date: '2025-01-15',
      description: 'A test notebook',
      categories: ['python', 'stats'],
      featured: true,
    });
  });

  it('parses frontmatter from a string-source cell', () => {
    const result = parseQuartoFrontmatter(rawCell(FULL_FRONTMATTER.join('')));
    expect(result?.title).toBe('My Notebook');
  });

  it('parses frontmatter from a markdown cell', () => {
    const cell: NotebookCell = {
      cell_type: 'markdown',
      source: '---\ntitle: "From Markdown"\n---\n',
      metadata: {},
    };
    expect(parseQuartoFrontmatter(cell)?.title).toBe('From Markdown');
  });

  it('coerces a scalar categories value to an array', () => {
    const result = parseQuartoFrontmatter(rawCell('---\ncategories: solo\n---\n'));
    expect(result?.categories).toEqual(['solo']);
  });

  it('preserves author arrays and coerces scalars', () => {
    expect(
      parseQuartoFrontmatter(rawCell('---\nauthor: ["A", "B"]\n---\n'))?.author
    ).toEqual(['A', 'B']);
    expect(
      parseQuartoFrontmatter(rawCell('---\nauthor: Solo\n---\n'))?.author
    ).toBe('Solo');
  });

  it('reads format options nested under the format key', () => {
    const result = parseQuartoFrontmatter(
      rawCell('---\nformat:\n  toc: false\n  toc-depth: 2\n---\n')
    );
    expect(result?.format).toEqual({ toc: false, 'toc-depth': 2 });
  });

  it('reads format and execute options at the root level', () => {
    const result = parseQuartoFrontmatter(
      rawCell('---\ntoc: true\ncode-fold: true\necho: false\n---\n')
    );
    expect(result?.format?.toc).toBe(true);
    expect(result?.format?.['code-fold']).toBe(true);
    expect(result?.execute?.echo).toBe(false);
  });

  it('reads execute options nested under the execute key', () => {
    const result = parseQuartoFrontmatter(
      rawCell('---\nexecute:\n  warning: false\n  output: false\n---\n')
    );
    expect(result?.execute).toEqual({ warning: false, output: false });
  });

  it('returns null for code cells', () => {
    const cell: NotebookCell = {
      cell_type: 'code',
      source: '---\ntitle: "Nope"\n---\n',
      metadata: {},
    };
    expect(parseQuartoFrontmatter(cell)).toBeNull();
  });

  it('returns null when the cell does not start with ---', () => {
    expect(parseQuartoFrontmatter(rawCell('# Just a heading\n'))).toBeNull();
  });

  it('returns null for invalid YAML', () => {
    expect(
      parseQuartoFrontmatter(rawCell('---\ntitle: [unclosed\n---\n'))
    ).toBeNull();
  });
});

describe('extractMetadata', () => {
  it('merges frontmatter over defaults', () => {
    const notebook = notebookWith([rawCell(FULL_FRONTMATTER)]);
    const metadata = extractMetadata(notebook, 'test-slug');

    expect(metadata.title).toBe('My Notebook');
    expect(metadata.featured).toBe(true);
    // Untouched defaults survive the merge
    expect(metadata.format?.toc).toBe(true);
    expect(metadata.format?.['toc-title']).toBe('Contents');
    expect(metadata.execute?.echo).toBe(true);
  });

  it('merges partial format options without clobbering defaults', () => {
    const notebook = notebookWith([rawCell('---\ntoc-depth: 2\n---\n')]);
    const metadata = extractMetadata(notebook, 'test-slug');

    expect(metadata.format?.['toc-depth']).toBe(2);
    expect(metadata.format?.toc).toBe(true);
  });

  it('falls back to defaults when the first cell is code', () => {
    const notebook = notebookWith([
      { cell_type: 'code', source: 'print(1)\n', metadata: {} },
    ]);
    const metadata = extractMetadata(notebook, 'my-cool-project');

    expect(metadata.title).toBe('My Cool Project');
    expect(metadata.categories).toEqual([]);
    expect(metadata.featured).toBe(false);
  });

  it('falls back to defaults for an empty notebook', () => {
    const metadata = extractMetadata(notebookWith([]), 'empty');
    expect(metadata.title).toBe('Empty');
  });
});

describe('getDefaultMetadata', () => {
  it('title-cases the slug', () => {
    expect(getDefaultMetadata('my-cool-project').title).toBe('My Cool Project');
  });

  it('uses a YYYY-MM-DD date', () => {
    expect(getDefaultMetadata('x').date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to visible code and outputs with a TOC', () => {
    const defaults = getDefaultMetadata('x');
    expect(defaults.format?.toc).toBe(true);
    expect(defaults.execute?.echo).toBe(true);
    expect(defaults.execute?.output).toBe(true);
  });
});
