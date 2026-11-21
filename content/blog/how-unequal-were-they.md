---
title: "How Unequal Were They?"
date: "2026-11-20"
categories: ["inequality", "data-visualization", "history"]
description: "Lorenz curves for Rome, Han China, medieval England, Soviet Russia, the modern United States and a few dozen other societies, with a year slider for each and a link to the source of every curve."
component: "GiniAtlas"
featured: false
---

# How Unequal Were They?

Every few years a chart goes around claiming that some ancient empire was more equal (or less) than the modern United States. They are fun to argue about and almost always compare two things that are not the same thing: someone's share of *income* in one society against someone's share of *wealth* in another, using data collected in completely different ways.

I wanted to see the whole picture in one place, with the caveats kept attached to the numbers. So this is an atlas of 33 societies, from an 11,000-year-old village on the Euphrates to the present day, drawn the same way, with every curve linking back to where it came from.

## How to read a curve

Line everyone in a society up from the poorest person to the richest. Now walk along the line and keep a running total of how much of the income (or wealth, or house floor area) the people you have passed hold between them.

That running total is a Lorenz curve. If everyone had the same, it would be the dashed diagonal: the poorest 50% hold 50%. The further the curve sags below the diagonal, the more the richer end holds. The Gini coefficient is just the area between the two lines, scaled so that 0 means perfect equality and 1 means one person holds everything.

The picture below has three views of the same data. **Curve** is the Lorenz curve. **Tenths** shows how much each tenth of the population holds, which is easier to read at a glance. **100 coins** imagines each society as 100 people sharing 100 coins and colours each coin by who holds it. Start with the questions across the top, then add whatever you like.

<!--viz-->

## A few things to try

**Rome against the United States.** The first question is the one the viral charts get wrong. According to Alfani, Bolla and Scheidel's 2025 estimate, the richest 1% of the Roman Empire around 165 CE took about 19% of income, and the poorest half took about 26%. In the United States in 2025 the richest 1% take about 21% and the poorest half about 13%. The top of the distribution is similar. The bottom half is where the difference is. Add US *wealth* and the picture changes completely: the top 1% hold about 35%, and the poorest half hold under 1%. That is why mixing measures is misleading, and why the lines on the chart change style (solid for income, dashed for wealth, dotted for house size).

**Scrub England.** The England and UK income series stitches together medieval tax records, three famous 17th and 18th century social tables, and modern statistics. Drag the slider and the curve sags a long way between the 1290 table and 1801, then recovers somewhat. One honest caveat: the old social tables only have a few dozen classes, so they cannot see inside the top class. Read their top 1% as a floor.

**Soviet Russia.** Switch to the Extremes question. In 1968 the richest 1% of Soviet Russia took 3.7% of income, the lowest top-1% share of any society here with full percentile data. In 2025 that figure is about 24%. The same slider, a few decades.

**Before written records.** The oldest points are not income at all but the *sizes of houses* excavated from archaeological sites, from the work of Tim Kohler and colleagues. Çatalhöyük looks quite equal (a Gini of about 0.28), the Kalahari !Kung San are the most equal in the dataset (0.17), and Kahun, the town built for the workers on a Middle Kingdom pyramid, is the most unequal (0.68). Those three numbers are all the source gives, so the curve shape is estimated from the Gini and labelled that way.

## What to keep in mind

Not all of these curves are the same kind of evidence. The label on each card says which:

- **Measured percentiles** come from tax and survey data, mostly from the [World Inequality Database](https://wid.world). The oldest years are imputed from sparse data. I dropped any year the database itself flags as an imputation from a neighbouring country.
- **Social tables** are historians' reconstructions of income by class, from the Global Price and Income History Group and the Roman and Han estimates. The curve runs in straight lines between classes, so inequality inside a class is invisible.
- **Published shares** are a handful of brackets (deciles, top 5%, top 1%), as for medieval English wealth.
- **Shape estimated from Gini** is exactly that. For the archaeological sites all the source gives is one number, so the curve is a smooth lognormal one with that Gini.

Net wealth can be negative, and in a few countries it is for the poorest tenth, which is why some wealth curves dip below zero and why a country like Sweden can show an extreme wealth Gini (0.98 in 2012) that mostly reflects household debt at the bottom, not a society of the very rich. I kept Sweden out of the wealth example for that reason.

Every card has a "Source & notes" link with the citation, what the number measures, and the licence. I checked each reconstructed curve against the Gini its source published. Almost all match to within a tenth of a point. The exceptions are Brazil in 1872 (about a point high) and the Roman and Han curves, which come out about 1.2 and 1.5 points below the published empire-wide Gini because I draw them from the paper's merged summary table. The cards show both numbers.

If you see something that looks wrong, it probably deserves a source check, and I would love to hear about it.
