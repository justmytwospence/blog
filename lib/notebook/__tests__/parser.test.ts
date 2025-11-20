/**
 * Tests for notebook parser
 */

import { parseNotebookFromString, parseNotebook } from '../parser';
import { Notebook } from '../types';

describe('parseNotebookFromString', () => {
  it('should parse a valid minimal notebook', () => {
    const validNotebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'markdown',
          source: 'Hello world',
          metadata: {}
        }
      ]
    });

    const result = parseNotebookFromString(validNotebook);
    
    expect(result.nbformat).toBe(4);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].cell_type).toBe('markdown');
  });

  it('should throw error for invalid JSON', () => {
    const invalidJson = '{ invalid json }';
    
    expect(() => parseNotebookFromString(invalidJson)).toThrow('Invalid JSON in notebook');
  });

  it('should throw error for notebook with nbformat < 4', () => {
    const oldNotebook = JSON.stringify({
      nbformat: 3,
      nbformat_minor: 0,
      metadata: {},
      cells: []
    });
    
    expect(() => parseNotebookFromString(oldNotebook)).toThrow('nbformat must be 4 or greater');
  });

  it('should throw error for notebook missing cells', () => {
    const noCells = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {}
    });
    
    expect(() => parseNotebookFromString(noCells)).toThrow('missing required field: cells');
  });

  it('should throw error for cell with invalid cell_type', () => {
    const invalidCellType = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'invalid',
          source: 'test',
          metadata: {}
        }
      ]
    });
    
    expect(() => parseNotebookFromString(invalidCellType)).toThrow('invalid cell_type');
  });

  it('should throw error for cell missing source', () => {
    const noSource = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'markdown',
          metadata: {}
        }
      ]
    });
    
    expect(() => parseNotebookFromString(noSource)).toThrow('missing required field: source');
  });

  it('should accept source as string', () => {
    const stringSource = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'code',
          source: 'print("hello")',
          metadata: {},
          outputs: [],
          execution_count: 1
        }
      ]
    });
    
    const result = parseNotebookFromString(stringSource);
    expect(result.cells[0].source).toBe('print("hello")');
  });

  it('should accept source as array of strings', () => {
    const arraySource = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'code',
          source: ['print("hello")\n', 'print("world")'],
          metadata: {},
          outputs: [],
          execution_count: 1
        }
      ]
    });
    
    const result = parseNotebookFromString(arraySource);
    expect(Array.isArray(result.cells[0].source)).toBe(true);
    expect((result.cells[0].source as string[]).length).toBe(2);
  });
});

describe('parseNotebook', () => {
  it('should throw error for non-existent file', () => {
    expect(() => parseNotebook('/nonexistent/file.ipynb')).toThrow('file not found');
  });
});
