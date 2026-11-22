---
title: "Millionaire Isn't What It Used to Be"
date: "2026-11-21"
categories: ["economics", "inflation", "data-visualization"]
description: "A million dollars was the finish line when you were 18. How far has it moved? That depends entirely on what you measure it against."
component: "MillionaireInflation"
featured: false
---

# Millionaire Isn't What It Used to Be

"Millionaire" is one of those words that stays fixed while the thing it measures drifts out from under it. When you were 18, a million dollars probably sounded like the finish line. The number on the finish line hasn't changed, but the finish line has moved.

The usual way to say how far is inflation: plug in the year, get a bigger number. But "rich" isn't only about what your money buys at the store. It's about what it buys relative to the things you actually want (a house, a degree, not having to work) and, honestly, relative to everyone else. Each of those is a different yardstick, and they disagree a lot.

Pick your age below. Each row is a different answer to the question "how much would I need today to be as rich as a millionaire was the year I turned 18?" The chart shows that answer for every age at once.

<!--viz-->

## Five answers to one question

| If you're | 25 | 35 | 45 | 55 |
| --- | --- | --- | --- | --- |
| Prices | \$1.30M | \$1.54M | \$1.99M | \$2.67M |
| Paychecks | \$1.27M | \$1.76M | \$2.15M | \$3.03M |
| Houses | \$1.63M | \$2.10M | \$3.21M | \$4.42M |
| College | \$1.13M | \$1.61M | \$3.06M | \$6.03M |
| Rank | \$2.12M | \$2.82M | \$4.72M | \$7.43M |

**Prices** is the familiar inflation answer, and it's the smallest number on the board for anyone over about 33.

**Paychecks** runs a little above prices. Median household income grew slightly faster than inflation, so a million dollars is fewer years of a typical household's income than it used to be.

**Houses** runs well above both, which won't surprise anyone who has shopped for one. It also has a kink: a 30-year-old and a 35-year-old need almost exactly the same amount, because both turned 18 in the long trough after the 2008 crash.

**College** is the wildest line for older readers (a 65-year-old's million is \$15M of tuition), but it bends the other way for younger ones. Tuition has grown more slowly than general prices since about 2011, so for anyone under about 33 it's the cheapest yardstick.

**Rank** is the one I find most striking. In 1989, about 3% of American households were worth \$1M or more. In 2025 it was 21.5%, more than one in five. Being a millionaire used to put you near the top of the country; now it puts you around the 80th percentile. To hold the same rank a 1989 millionaire held, you'd need about \$7.4M today. Wealth has grown faster than prices, paychecks, and even houses, so if "rich" means "richer than most people," the finish line has moved furthest of all.

Which yardstick is right? None of them, exactly. Prices tell you what your money buys, rank tells you where it puts you, and the others are somewhere in between. But the next time someone says a million dollars isn't what it used to be, the honest answer is "compared to what?"

## How it's calculated

Every row answers the same question: \$1M in the year you turned 18, times how much the yardstick has grown since then. "Today" is the trailing year ending at each series' latest release; past years are calendar-year averages.

- **Prices**: CPI-U, all items, through October 2026 (BLS).
- **Paychecks**: median household income, latest year 2025 (Census). Before 1984, it's extended back with median family income, spliced at 1984.
- **Houses**: FHFA's U.S. All-Transactions House Price Index through Q2 2026, from 1975. It tracks the price of a comparable house, not the cost of owning one (no mortgage rates, taxes or insurance), and it's a national average.
- **College**: the CPI's college tuition and fees index (BLS), from 1978.
- **Rank**: the Federal Reserve's Survey of Consumer Finances, every three years from 1989 through 2025. For each survey I computed the share of households with a net worth of at least \$1M, interpolated between surveys, and found the net worth that puts a household at the same rank in the 2025 survey. That's then carried to mid-2026 by the growth in household net worth per household from the Fed's Financial Accounts. Net worth includes home equity and retirement accounts.

Sources: [BLS CPI](https://www.bls.gov/cpi/), [Census income tables](https://www.census.gov/topics/income-poverty/income/data/tables.html) via [FRED](https://fred.stlouisfed.org/series/MEHOINUSA646N), [FHFA House Price Index](https://www.fhfa.gov/data/hpi), [Survey of Consumer Finances](https://www.federalreserve.gov/econres/scfindex.htm), [Financial Accounts of the United States](https://www.federalreserve.gov/releases/z1/).
