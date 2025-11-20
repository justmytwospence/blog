/**
 * Tests for notebook validator
 */

import { validateNotebook, validateCell, isValidNotebook } from '../validator';

describe('validateNotebook', () => {
  it('should validate a valid notebook', () => {
    const validNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'markdown',
          source: 'Hello',
          metadata: {}
        }
      ]
    };

    expect(() => validateNotebook(validNotebook)).not.toThrow();
  });

  it('should throw error if notebook is not an object', () => {
    expect(() => validateNotebook(null)).toThrow('must be an object');
    expect(() => validateNotebook('string')).toThrow('must be an object');
    expect(() => validateNotebook(123)).toThrow('must be an object');
  });

  it('should throw error if nbformat is missing', () => {
    const noNbformat = {
      metadata: {},
      cells: []
    };

    expect(() => validateNotebook(noNbformat)).toThrow('missing required field: nbformat');
  });

  it('should throw error if nbformat is not a number', () => {
    const invalidNbformat = {
      nbformat: '4',
      metadata: {},
      cells: []
    };

    expect(() => validateNotebook(invalidNbformat)).toThrow('nbformat field must be a number');
  });

  it('should throw error if nbformat is less than 4', () => {
    const oldNbformat = {
      nbformat: 3,
      nbformat_minor: 0,
      metadata: {},
      cells: []
    };

    expect(() => validateNotebook(oldNbformat)).toThrow('nbformat must be 4 or greater');
  });

  it('should throw error if cells is missing', () => {
    const noCells = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {}
    };

    expect(() => validateNotebook(noCells)).toThrow('missing required field: cells');
  });

  it('should throw error if cells is not an array', () => {
    const invalidCells = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: 'not an array'
    };

    expect(() => validateNotebook(invalidCells)).toThrow('cells field must be an array');
  });
});

describe('validateCell', () => {
  it('should validate a valid markdown cell', () => {
    const validCell = {
      cell_type: 'markdown',
      source: 'Hello',
      metadata: {}
    };

    expect(() => validateCell(validCell, 0)).not.toThrow();
  });

  it('should validate a valid code cell', () => {
    const validCell = {
      cell_type: 'code',
      source: 'print("hello")',
      metadata: {},
      outputs: [],
      execution_count: 1
    };

    expect(() => validateCell(validCell, 0)).not.toThrow();
  });

  it('should validate a valid raw cell', () => {
    const validCell = {
      cell_type: 'raw',
      source: 'raw content',
      metadata: {}
    };

    expect(() => validateCell(validCell, 0)).not.toThrow();
  });

  it('should throw error if cell is not an object', () => {
    expect(() => validateCell(null, 0)).toThrow('Cell at index 0 must be an object');
    expect(() => validateCell('string', 1)).toThrow('Cell at index 1 must be an object');
  });

  it('should throw error if cell_type is missing', () => {
    const noType = {
      source: 'Hello',
      metadata: {}
    };

    expect(() => validateCell(noType, 0)).toThrow('missing required field: cell_type');
  });

  it('should throw error if cell_type is invalid', () => {
    const invalidType = {
      cell_type: 'invalid',
      source: 'Hello',
      metadata: {}
    };

    expect(() => validateCell(invalidType, 0)).toThrow('invalid cell_type: "invalid"');
  });

  it('should throw error if source is missing', () => {
    const noSource = {
      cell_type: 'markdown',
      metadata: {}
    };

    expect(() => validateCell(noSource, 0)).toThrow('missing required field: source');
  });

  it('should throw error if source is not string or string array', () => {
    const invalidSource = {
      cell_type: 'markdown',
      source: 123,
      metadata: {}
    };

    expect(() => validateCell(invalidSource, 0)).toThrow('invalid source field');
  });

  it('should accept source as string', () => {
    const stringSource = {
      cell_type: 'markdown',
      source: 'Hello world',
      metadata: {}
    };

    expect(() => validateCell(stringSource, 0)).not.toThrow();
  });

  it('should accept source as array of strings', () => {
    const arraySource = {
      cell_type: 'markdown',
      source: ['Hello ', 'world'],
      metadata: {}
    };

    expect(() => validateCell(arraySource, 0)).not.toThrow();
  });

  it('should throw error if source array contains non-strings', () => {
    const mixedArray = {
      cell_type: 'markdown',
      source: ['Hello', 123, 'world'],
      metadata: {}
    };

    expect(() => validateCell(mixedArray, 0)).toThrow('invalid source field');
  });

  it('should throw error if code cell outputs is not an array', () => {
    const invalidOutputs = {
      cell_type: 'code',
      source: 'print("hello")',
      metadata: {},
      outputs: 'not an array'
    };

    expect(() => validateCell(invalidOutputs, 0)).toThrow('invalid outputs field: must be an array');
  });

  it('should throw error if code cell execution_count is invalid', () => {
    const invalidExecCount = {
      cell_type: 'code',
      source: 'print("hello")',
      metadata: {},
      outputs: [],
      execution_count: 'not a number'
    };

    expect(() => validateCell(invalidExecCount, 0)).toThrow('invalid execution_count');
  });

  it('should accept null execution_count', () => {
    const nullExecCount = {
      cell_type: 'code',
      source: 'print("hello")',
      metadata: {},
      outputs: [],
      execution_count: null
    };

    expect(() => validateCell(nullExecCount, 0)).not.toThrow();
  });
});

describe('isValidNotebook', () => {
  it('should return true for valid notebook', () => {
    const validNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: []
    };

    expect(isValidNotebook(validNotebook)).toBe(true);
  });

  it('should return false for invalid notebook', () => {
    const invalidNotebook = {
      nbformat: 3,
      metadata: {},
      cells: []
    };

    expect(isValidNotebook(invalidNotebook)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidNotebook(null)).toBe(false);
    expect(isValidNotebook('string')).toBe(false);
    expect(isValidNotebook(123)).toBe(false);
  });
});
