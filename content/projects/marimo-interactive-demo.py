# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "marimo",
#   "numpy",
#   "pandas",
#   "altair",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium", app_title="Marimo Interactive Demo")


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ---
        title: "Marimo Interactive Demo"
        author: "Spencer Boucher"
        date: "2026-06-13"
        description: "A reactive marimo notebook running live in your browser via WebAssembly."
        categories:
          - marimo
          - interactive
          - showcase
        featured: false
        interactive: true
        interactive-mode: run
        ---
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        # Interactive marimo demo

        This notebook runs **entirely in your browser** via WebAssembly (Pyodide) — no
        server. Drag the sliders or change the function and the chart recomputes reactively.
        The first load fetches Python, so give it a few seconds.
        """
    )
    return


@app.cell
def _():
    import altair as alt
    import marimo as mo
    import numpy as np
    import pandas as pd

    return alt, mo, np, pd


@app.cell
def _(mo):
    amplitude = mo.ui.slider(0.1, 2.0, value=1.0, step=0.1, label="Amplitude")
    frequency = mo.ui.slider(1, 10, value=3, label="Frequency")
    fn = mo.ui.dropdown(options=["sin", "cos", "tanh"], value="sin", label="Function")
    mo.hstack([amplitude, frequency, fn], justify="start", gap=2)
    return amplitude, fn, frequency


@app.cell
def _(alt, amplitude, fn, frequency, mo, np, pd):
    _x = np.linspace(0, 2 * np.pi, 400)
    _wave = {"sin": np.sin, "cos": np.cos, "tanh": np.tanh}[fn.value]
    _y = amplitude.value * _wave(frequency.value * _x)
    _df = pd.DataFrame({"x": _x, "y": _y})
    _chart = (
        alt.Chart(_df)
        .mark_line()
        .encode(x="x", y="y")
        .properties(
            height=320,
            title=f"y = {amplitude.value} · {fn.value}({frequency.value}x)",
        )
    )
    mo.ui.altair_chart(_chart)
    return


@app.cell
def _(amplitude, fn, frequency, mo):
    mo.md(
        f"**Live values** — function = `{fn.value}`, amplitude = {amplitude.value}, "
        f"frequency = {frequency.value}"
    )
    return


if __name__ == "__main__":
    app.run()
