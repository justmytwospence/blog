# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "marimo",
#   "numpy",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium", app_title="Marimo Feature Tour")


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ---
        title: "Marimo Feature Tour"
        author: "Spencer Boucher"
        date: "2026-06-13"
        description: "A marimo notebook that exercises the full Quarto-style rendering pipeline."
        categories:
          - marimo
          - notebooks
          - showcase
        featured: false
        format:
          toc: true
          toc-depth: 4
          toc-title: "On this page"
          code-fold: false
          code-tools: false
          code-line-numbers: true
        execute:
          echo: true
          warning: true
          error: true
          output: true
          include: true
        ---
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        # Marimo feature tour

        This post is authored as a **marimo** notebook — a pure-Python `.py` file — and
        rendered through the blog's *Quarto-style* pipeline by `@blog/notebook-parser`.
        It exists to exercise as many rendering features as possible in one place.

        Read more in the [marimo docs](https://docs.marimo.io) or browse the other
        [projects](/projects).
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Prose, lists, and quotes

        Inline formatting works: **bold**, *italic*, ***both***, and `inline code`.

        An unordered list:

        - first item
        - second item, with some `code`
        - third item

        An ordered list:

        1. step one
        2. step two
        3. step three

        > Blockquotes render too — handy for asides and pull quotes.
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Math

        ### Inline

        Euler's identity $e^{i\pi} + 1 = 0$ renders inline via KaTeX.

        ### Display

        $$
        \int_0^1 x^2 \, dx = \frac{1}{3}
        \qquad
        \sum_{k=1}^{n} k = \frac{n(n+1)}{2}
        $$
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Heading levels

        The table of contents is built from markdown headings, so every level is
        available for structure.

        #### Level four
        ##### Level five
        ###### Level six
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Callouts

        Four Quarto callout types are supported, plus custom titles and collapsing.

        :::{.callout-note}
        A **note** callout. It can contain markdown and even math like $a^2 + b^2 = c^2$.
        :::

        :::{.callout-tip}
        ## A tip with a custom title
        The first `## ` line inside a callout becomes its title.
        :::

        :::{.callout-warning}
        A **warning** callout — use these to flag gotchas.
        :::

        :::{.callout-important collapse="true"}
        An **important**, collapsible callout. It starts collapsed; click to expand.
        :::
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Tables

        GFM tables become sortable, paginated interactive tables.

        | Feature   | Renders as         | Interactive? |
        |-----------|--------------------|--------------|
        | Headings  | h1–h6 + ToC        | no           |
        | Tables    | InteractiveTable   | yes (sort)   |
        | Math      | KaTeX              | no           |
        | Callouts  | styled blocks      | collapsible  |
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## Code cells

        marimo `.py` files store no outputs, so code cells render their **source** with
        syntax highlighting and (by default) line numbers. A fenced block inside markdown
        is highlighted too, but is distinct from a real code cell:

        ```python
        # fenced code block inside markdown
        def greet(name):
            return f"hello, {name}"
        ```

        The cells below show the per-cell controls — fold/show, collapsed-by-default, and
        line-number toggling — driven by Quarto `#|` directives and marimo decorators.
        """
    )
    return


@app.cell
def _():
    import marimo as mo
    import numpy as np

    return mo, np


@app.cell
def _(np):
    #| code-fold: show
    #| code-summary: Compute a sine wave
    angles = np.linspace(0, np.pi, 9)
    heights = np.sin(angles)
    heights
    return angles, heights


@app.cell(hide_code=True)
def _(np):
    squares = np.array([n * n for n in range(1, 8)])
    squares
    return (squares,)


@app.cell
def _(
    angles,
    heights,
):
    paired = list(zip(angles.round(3), heights.round(3)))
    paired
    return (paired,)


@app.cell
def _():
    #| code-line-numbers: false
    message = "This cell turns line numbers off with a per-cell directive."
    message
    return (message,)


@app.cell(disabled=True)
def _():
    # A disabled cell: marimo won't run it; the blog shows it collapsed.
    placeholder = 1 + 1
    placeholder
    return (placeholder,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ## marimo-specific constructs

        The parser also understands SQL cells, top-level functions and classes, and it
        gracefully falls back to a code cell when `mo.md(...)` is dynamic.
        """
    )
    return


@app.cell
def _(mo):
    _engine = mo.sql("""SELECT 'marimo' AS engine, 42 AS answer""")
    return


@app.function
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


@app.class_definition
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def norm(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5


@app.cell
def _(heights, mo, np):
    mo.md(f"The peak height is **{np.max(heights):.3f}** (rendered as code via f-string fallback).")
    return


@app.cell
def _(mo):
    _note = "Built from a variable, so this renders as code, not markdown."
    mo.md(_note)
    return


if __name__ == "__main__":
    app.run()
