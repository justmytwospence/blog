/**
 * Tests for the marimo (.py) notebook parser
 */

import { parseMarimoFromString, parseMarimoNotebook, isMarimoSource } from '../src/marimo';
import { getCellOptions, generateTableOfContents, getNotebookLanguage, getCellSource } from '../src/utils';
import { extractMetadata } from '../src/metadata';

const BASIC = `import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np


@app.cell
def _(mo):
    mo.md(r"""# Hello""")
    return


@app.cell
def _(np):
    x = np.array([1, 2, 3])
    x
    return (x,)


if __name__ == "__main__":
    app.run()
`;

const PEP723 = `# /// script
# requires-python = ">=3.11"
# dependencies = ["marimo", "numpy"]
# ///

${BASIC}`;

const WITH_MD = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell
def _(mo):
    mo.md(
        r"""
        ---
        title: My MO Notebook
        categories: [viz, demo]
        toc-depth: 2
        execute:
          echo: false
        ---
        """
    )
    return


@app.cell
def _(mo):
    mo.md(
        r"""
        # Section One

        Some text with math $x^2$ and a list:

        - a
        - b
        """
    )
    return


@app.cell
def _():
    import marimo as mo
    return (mo,)


if __name__ == "__main__":
    app.run()
`;

const DIRECTIVE = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell
def _(plt):
    #| echo: false
    #| fig-cap: My Plot
    #| label: fig-plot
    plt.plot([1, 2, 3])
    return


if __name__ == "__main__":
    app.run()
`;

const FLAGS = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell(hide_code=True)
def _(np):
    y = np.zeros(3)
    y
    return (y,)


@app.cell(disabled=True)
def _():
    z = 1
    return (z,)


if __name__ == "__main__":
    app.run()
`;

const SETUP_FN = `import marimo

__generated_with = "0.23.6"
app = marimo.App()

with app.setup:
    import numpy as np


@app.function
def calculate_statistics(data):
    return sum(data)


@app.class_definition
class Foo:
    pass


@app.cell
def _():
    a = 1
    return (a,)


if __name__ == "__main__":
    app.run()
`;

const DYNAMIC_MD = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell
def _(x):
    mo.md(f"""value = {x}""")
    return


@app.cell
def _(mo, _md):
    mo.md(_md)
    return


if __name__ == "__main__":
    app.run()
`;

const SQL = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell
def _(mo, df):
    _result = mo.sql(r"""SELECT * FROM df""")
    return (_result,)


if __name__ == "__main__":
    app.run()
`;

const MULTILINE_DEF = `import marimo

__generated_with = "0.23.6"
app = marimo.App()


@app.cell
def _(
    a,
    b,
):
    c = a + b
    return (c,)


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
`;

const NON_MARIMO = `import numpy as np


def f(x):
    return x * 2


print(f(3))
`;

describe('isMarimoSource', () => {
  it('is true for marimo notebooks', () => {
    expect(isMarimoSource(BASIC)).toBe(true);
    expect(isMarimoSource(PEP723)).toBe(true);
    expect(isMarimoSource(SETUP_FN)).toBe(true);
  });

  it('is false for an ordinary python script', () => {
    expect(isMarimoSource(NON_MARIMO)).toBe(false);
  });
});

describe('parseMarimoFromString — structure', () => {
  it('produces a valid nbformat-4 notebook with python language', () => {
    const nb = parseMarimoFromString(BASIC);
    expect(nb.nbformat).toBe(4);
    expect(getNotebookLanguage(nb)).toBe('python');
  });

  it('emits one cell per marimo cell in file order with correct types', () => {
    const nb = parseMarimoFromString(BASIC);
    expect(nb.cells.map((c) => c.cell_type)).toEqual(['code', 'markdown', 'code']);
    // code cells carry empty outputs / null execution count
    const code = nb.cells.filter((c) => c.cell_type === 'code');
    code.forEach((c) => {
      expect(c.outputs).toEqual([]);
      expect(c.execution_count).toBeNull();
    });
  });

  it('skips module boilerplate (import marimo / app = / __generated_with / __main__)', () => {
    const nb = parseMarimoFromString(BASIC);
    const allSource = nb.cells.map((c) => c.source).join('\n');
    expect(allSource).not.toContain('marimo.App(');
    expect(allSource).not.toContain('__generated_with');
    expect(allSource).not.toContain('__main__');
  });

  it('strips the auto-generated trailing return, keeping cell code', () => {
    const nb = parseMarimoFromString(BASIC);
    const importCell = nb.cells[0];
    expect(importCell.source).toContain('import marimo as mo');
    expect(importCell.source).toContain('import numpy as np');
    expect(importCell.source).not.toContain('return mo, np');
    const xCell = nb.cells[2];
    expect(xCell.source).toBe('x = np.array([1, 2, 3])\nx');
  });

  it('drops a cell that contains only the auto-return', () => {
    const nb = parseMarimoFromString(MULTILINE_DEF);
    // only the `c = a + b` cell survives; the `return`-only cell is dropped
    expect(nb.cells).toHaveLength(1);
    expect(nb.cells[0].source).toBe('c = a + b');
  });

  it('handles a multi-line def signature', () => {
    const nb = parseMarimoFromString(MULTILINE_DEF);
    expect(nb.cells[0].source).toBe('c = a + b');
  });

  it('skips a PEP 723 inline-metadata header', () => {
    const nb = parseMarimoFromString(PEP723);
    expect(nb.cells.map((c) => c.cell_type)).toEqual(['code', 'markdown', 'code']);
    const allSource = nb.cells.map((c) => c.source).join('\n');
    expect(allSource).not.toContain('requires-python');
  });

  it('parses CRLF line endings identically to LF', () => {
    const lf = parseMarimoFromString(BASIC);
    const crlf = parseMarimoFromString(BASIC.replace(/\n/g, '\r\n'));
    expect(crlf.cells.map((c) => c.cell_type)).toEqual(lf.cells.map((c) => c.cell_type));
    expect(crlf.cells[2].source).toBe(lf.cells[2].source);
  });
});

describe('parseMarimoFromString — markdown extraction', () => {
  it('extracts mo.md literal content and dedents it (no 4-space code block)', () => {
    const nb = parseMarimoFromString(WITH_MD);
    const section = nb.cells[1];
    expect(section.cell_type).toBe('markdown');
    expect(section.source).toBe('# Section One\n\nSome text with math $x^2$ and a list:\n\n- a\n- b');
    expect(getCellSource(section).split('\n').every((l: string) => !l.startsWith('    '))).toBe(true);
  });

  it('renders a single-line mo.md', () => {
    const nb = parseMarimoFromString(BASIC);
    expect(nb.cells[1]).toMatchObject({ cell_type: 'markdown', source: '# Hello' });
  });

  it('falls back to a code cell for f-string and variable mo.md', () => {
    const nb = parseMarimoFromString(DYNAMIC_MD);
    expect(nb.cells.map((c) => c.cell_type)).toEqual(['code', 'code']);
    expect(nb.cells[0].source).toContain('mo.md(f');
    expect(nb.cells[1].source).toBe('mo.md(_md)');
  });
});

describe('parseMarimoFromString — column-0 mo.md content (hand-written notebooks)', () => {
  // marimo *generated* files indent string content, but a hand-written notebook can put
  // mo.md content at column 0. The parser must not truncate the cell at those lines.
  const COL0 = `import marimo

app = marimo.App()


@app.cell
def _(mo):
    mo.md(r"""
---
title: Hand Written
categories: [hand]
---

# Intro
""")
    return


@app.cell
def _(mo):
    mo.md(r"""
## Section

:::{.callout-note}
A note at column zero.
:::
""")
    return


@app.cell
def _():
    x = 1
    return (x,)


if __name__ == "__main__":
    app.run()
`;

  it('keeps column-0 frontmatter inside mo.md and extracts metadata', () => {
    const nb = parseMarimoFromString(COL0);
    expect(nb.cells[0].cell_type).toBe('markdown');
    expect(getCellSource(nb.cells[0]).trim().startsWith('---')).toBe(true);
    expect(extractMetadata(nb, 'x').title).toBe('Hand Written');
    expect(extractMetadata(nb, 'x').categories).toContain('hand');
  });

  it('keeps column-0 headings and callouts inside mo.md', () => {
    const nb = parseMarimoFromString(COL0);
    expect(nb.cells[1].cell_type).toBe('markdown');
    const src = getCellSource(nb.cells[1]);
    expect(src).toContain('## Section');
    expect(src).toContain(':::{.callout-note}');
  });

  it('still parses the following code cell correctly (body not over-consumed)', () => {
    const nb = parseMarimoFromString(COL0);
    expect(nb.cells[2]).toMatchObject({ cell_type: 'code', source: 'x = 1' });
  });
});

describe('parseMarimoFromString — decorator flags', () => {
  it('maps hide_code and disabled to code-fold metadata', () => {
    const nb = parseMarimoFromString(FLAGS);
    const [hidden, disabled] = nb.cells;
    expect(hidden.cell_type).toBe('code');
    expect(hidden.metadata?.['code-fold']).toBe('hide');
    expect(disabled.cell_type).toBe('code');
    expect(disabled.metadata?.['code-fold']).toBe('hide');
    expect(disabled.metadata?.['marimo-disabled']).toBe(true);
  });
});

describe('parseMarimoFromString — setup / function / class', () => {
  it('emits setup, function and class blocks as verbatim code cells', () => {
    const nb = parseMarimoFromString(SETUP_FN);
    const sources = nb.cells.map((c) => c.source);
    expect(nb.cells.every((c) => c.cell_type === 'code')).toBe(true);
    expect(sources[0]).toBe('import numpy as np');
    expect(sources[1]).toBe('def calculate_statistics(data):\n    return sum(data)');
    expect(sources[2]).toBe('class Foo:\n    pass');
    expect(sources[3]).toBe('a = 1');
  });
});

describe('parseMarimoFromString — SQL', () => {
  it('keeps mo.sql cells as code and tags them', () => {
    const nb = parseMarimoFromString(SQL);
    expect(nb.cells[0].cell_type).toBe('code');
    expect(nb.cells[0].source).toContain('mo.sql');
    expect(nb.cells[0].metadata?.['marimo-kind']).toBe('sql');
  });
});

describe('Quarto feature parity', () => {
  it('parses per-cell #| directives via getCellOptions (dedented to col 0)', () => {
    const nb = parseMarimoFromString(DIRECTIVE);
    const cell = nb.cells[0];
    expect(cell.cell_type).toBe('code');
    const opts = getCellOptions(cell);
    expect(opts.echo).toBe(false);
    expect(opts['fig-cap']).toBe('My Plot');
    expect(opts.label).toBe('fig-plot');
  });

  it('builds a ToC from dedented markdown headings', () => {
    const nb = parseMarimoFromString(WITH_MD);
    const toc = generateTableOfContents(nb);
    expect(toc.some((e) => e.text === 'Section One')).toBe(true);
  });

  it('reads doc-level Quarto frontmatter from the first mo.md cell', () => {
    const nb = parseMarimoFromString(WITH_MD);
    expect(nb.cells[0].cell_type).toBe('markdown');
    expect(getCellSource(nb.cells[0]).trim().startsWith('---')).toBe(true);

    const meta = extractMetadata(nb, 'fallback-slug');
    expect(meta.title).toBe('My MO Notebook');
    expect(meta.categories).toContain('viz');
    expect(meta.format['toc-depth']).toBe(2);
    expect(meta.execute.echo).toBe(false);
  });

  it('falls back to slug-derived metadata when there is no frontmatter', () => {
    const nb = parseMarimoFromString(BASIC);
    const meta = extractMetadata(nb, 'my-demo-notebook');
    expect(meta.title).toBe('My Demo Notebook');
  });
});

describe('parseMarimoNotebook', () => {
  it('throws for a non-existent file', () => {
    expect(() => parseMarimoNotebook('/nonexistent/file.py')).toThrow('file not found');
  });
});
