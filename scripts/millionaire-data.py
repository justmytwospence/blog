# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "numpy"]
# ///
"""Build data/millionaire/yardsticks.json for the "Millionaire Isn't What It Used to Be" post.

For every year a reader could have turned 18 (1940 onward), each yardstick gives the number of
today's dollars that stand where $1 stood that year:

- cpi:     CPI-U, all items (BLS via FRED CPIAUCNS)
- homes:   FHFA U.S. All-Transactions House Price Index (FRED USSTHPI), from 1975
- income:  median household income (Census via FRED MEHOINUSA646N, 1984+); before 1984 it is
           extended back with median family income (MEFAINUSA646N, 1953+), spliced at 1984
- tuition: CPI-U college tuition and fees (BLS CUUR0000SEEB01), from 1978
- rank:    the net worth that holds the same rank among U.S. households today that $1M held in
           that year. Each Survey of Consumer Finances (1989-2025, triennial) gives the share of
           households worth at least $1M nominal (summary-extract weights, with the extract's
           constant dollars converted back to nominal by matching the Fed's published nominal mean).
           Shares are interpolated linearly between surveys, mapped to a net worth through the 2025
           survey's distribution, and moved to today by the growth in Financial Accounts household
           net worth per household (FRED TNWBSHNO / TTLHH).

"Today" is the trailing year ending at each series' latest release: the last 12 monthly readings,
the last four quarters, or the latest annual value; past years are calendar-year averages.

Run: uv run scripts/millionaire-data.py   (downloads to a cache dir; ~50MB of SCF files)
"""

from __future__ import annotations

import io
import json
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "millionaire" / "yardsticks.json"
CACHE = ROOT / "node_modules" / ".cache" / "millionaire"
FIRST_YEAR = 1940
SCF_YEARS = [1989, 1992, 1995, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
# Published nominal mean family net worth, thousands (SCF 2025 nominal historical tables, Table 4).
SCF_NOMINAL_MEAN = {
    1989: 189.37, 1992: 187.07, 1995: 213.12, 1998: 283.64, 2001: 397.56, 2004: 449.13, 2007: 556.78,
    2010: 494.75, 2013: 528.42, 2016: 689.5, 2019: 746.81, 2022: 1059.46, 2025: 1232,
}


def fetch(url: str, name: str, data: bytes | None = None) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        # FRED stalls on browser-like user agents; a plain client string gets an immediate answer.
        headers = {"User-Agent": "curl/8.7.1"} | ({"Content-Type": "application/json"} if data else {})
        req = urllib.request.Request(url, data=data, headers=headers)
        path.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return path.read_bytes()


def fred(series: str) -> pd.Series:
    raw = fetch(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}", f"{series}.csv")
    df = pd.read_csv(io.BytesIO(raw), na_values=["."])
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"])
    return df.dropna().set_index("date")["value"]


def bls_monthly(series: str, start: int, end: int) -> pd.Series:
    out = {}
    for y in range(start, end + 1, 10):
        body = json.dumps({"seriesid": [series], "startyear": str(y), "endyear": str(min(y + 9, end))}).encode()
        raw = fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", f"{series}-{y}.json", body)
        for row in json.loads(raw)["Results"]["series"][0]["data"]:
            if row["period"].startswith("M") and row["period"] != "M13" and row["value"] != "-":
                out[pd.Timestamp(int(row["year"]), int(row["period"][1:]), 1)] = float(row["value"])
    return pd.Series(out).sort_index()


def index_ratio(s: pd.Series, window: int) -> tuple[dict[int, float], str]:
    """Today's level (mean of the last `window` observations) over each calendar-year mean."""
    now = s.iloc[-window:].mean()
    annual = s.groupby(s.index.year).mean()
    asof = s.index[-1].strftime("%Y-%m")
    return {int(y): now / v for y, v in annual.items()}, asof


def income_ratio() -> tuple[dict[int, float], str]:
    hh = fred("MEHOINUSA646N")
    fam = fred("MEFAINUSA646N")
    hh_y = {d.year: v for d, v in hh.items()}
    fam_y = {d.year: v for d, v in fam.items()}
    splice = hh_y[1984] / fam_y[1984]
    level = {y: fam_y[y] * splice for y in fam_y if y < 1984} | hh_y
    latest = max(level)
    return {y: level[latest] / v for y, v in level.items()}, str(latest)


def scf_rank() -> tuple[dict[int, float], dict[int, float], str]:
    shares, dist25 = {}, None
    for y in SCF_YEARS:
        z = zipfile.ZipFile(io.BytesIO(fetch(f"https://www.federalreserve.gov/econres/files/scfp{y}s.zip", f"scfp{y}s.zip")))
        df = pd.read_stata(z.open(f"rscfp{y}.dta"), columns=["networth", "wgt"])
        w, nw = df["wgt"].to_numpy(), df["networth"].to_numpy()
        nominal = nw / (np.average(nw, weights=w) / (SCF_NOMINAL_MEAN[y] * 1000))
        shares[y] = float(w[nominal >= 1e6].sum() / w.sum())
        if y == SCF_YEARS[-1]:
            order = np.argsort(nominal)
            dist25 = (nominal[order], np.cumsum(w[order]) / w.sum())

    # Financial Accounts net worth per household: trailing four quarters vs. the survey year.
    nw = fred("TNWBSHNO")
    hh = fred("TTLHH")
    per_hh = lambda v, yr: v / float(hh[hh.index.year == yr].iloc[0])  # noqa: E731
    survey = SCF_YEARS[-1]
    then = per_hh(nw[nw.index.year == survey].mean(), survey)
    now = per_hh(nw.iloc[-4:].mean(), nw.index[-1].year)
    drift = now / then

    values, cum = dist25
    years = np.arange(SCF_YEARS[0], SCF_YEARS[-1] + 1)
    interp = np.interp(years, SCF_YEARS, [shares[y] for y in SCF_YEARS])
    rank = {}
    for y, share in zip(years, interp):
        level = float(values[np.searchsorted(cum, 1 - share)])
        rank[int(y)] = level * drift / 1e6
    return rank, {int(y): float(s) for y, s in zip(years, interp)}, nw.index[-1].strftime("%Y-%m")


def main() -> None:
    cpi, cpi_asof = index_ratio(fred("CPIAUCNS"), 12)
    homes, homes_asof = index_ratio(fred("USSTHPI"), 4)
    tuition, tuition_asof = index_ratio(bls_monthly("CUUR0000SEEB01", 1978, pd.Timestamp.today().year), 12)
    income, income_asof = income_ratio()
    rank, share, rank_asof = scf_rank()

    last = max(cpi)
    rows = []
    for y in range(FIRST_YEAR, last + 1):
        row = {"year": y}
        for key, series in [("cpi", cpi), ("homes", homes), ("income", income), ("tuition", tuition), ("rank", rank)]:
            if y in series:
                row[key] = round(series[y], 4)
        if y in share:
            row["millionaireShare"] = round(share[y], 4)
        if y == last:
            # Turning 18 this year: $1M is $1M by definition, whatever a partial-year average says.
            row.update(cpi=1, homes=1, income=1, tuition=1, rank=1)
        rows.append(row)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "asOf": {"cpi": cpi_asof, "homes": homes_asof, "income": income_asof, "tuition": tuition_asof, "rank": rank_asof},
                "rows": rows,
            },
            indent=1,
        )
        + "\n"
    )
    print(f"wrote {OUT.relative_to(ROOT)}: {len(rows)} years")


if __name__ == "__main__":
    main()
