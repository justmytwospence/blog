---
title: "How Unequal Were They?"
date: "2026-11-20"
categories: ["inequality", "data-visualization", "history"]
description: "After the Anthropic IPO I wanted to know whether things used to be worse. I lined up the wealth and income curves of Rome, medieval England, Soviet Russia, the modern United States and a few dozen other societies. The reassurance did not quite work."
component: "GiniAtlas"
featured: false
---

# How Unequal Were They?

After Anthropic went public, a lot of people I know (and a lot of people I do not) suddenly had an amount of money that is hard to think about. I live in San Francisco, so I have been wondering what that does to the city, and more vaguely to everything else: rents, who can afford to stay, what it is like to be one of the people who cannot.

My instinct was to go looking for reassurance. Surely this has happened before. Surely Gilded Age robber barons, Roman senators and medieval lords were much worse, and we muddled through. So I went and collected the context. This is the result: an atlas of 33 societies, from an 11,000-year-old village on the Euphrates to the present day, drawn the same way, with every curve linking back to where it came from.

The short version is that I got less reassurance than I was hoping for. The longer version is below, after the thing itself.

## How to read a curve

Line everyone in a society up from the poorest person to the richest. Now walk along the line and keep a running total of how much of the income (or wealth, or house floor area) the people you have passed hold between them.

That running total is a Lorenz curve. If everyone had the same, it would be the straight diagonal: the poorest 50% hold 50%. The further the curve sags below the diagonal, the more the richer end holds. The Gini coefficient is just the area between the two lines, scaled so that 0 means perfect equality and 1 means one person holds everything.

The picture below has three views of the same data. **Curve** is the Lorenz curve. **Tenths** shows how much each tenth of the population holds, which is easier to read at a glance. **100 coins** imagines each society as 100 people sharing 100 coins and colours each coin by who holds it. Start with the questions across the top, then add whatever you like.

<!--viz-->

## Were things worse?

Sometimes, yes. Mostly not by as much as I wanted.

**Rome against the United States.** The first question is the one I wanted a comfortable answer to. According to Alfani, Bolla and Scheidel's 2025 estimate, the richest 1% of the Roman Empire around 165 CE took about 19% of income, and the poorest half took about 26%. In the United States in 2025 the richest 1% take about 21% and the poorest half about 13%. So at the top the two are about the same, and the bottom half of the United States does noticeably worse than the bottom half of an ancient slave-owning empire. Add US *wealth* and the picture changes completely: the top 1% hold about 35%, and the poorest half hold under 1%. (Those two are different things, which is why each line on the chart is labelled with its measure.)

**America since 1913.** This is the one that is supposed to be reassuring, and it is a little. In 1929 the richest 1% took about 22% of income. By 1980 it was about 10%. Today it is back to about 21%. The Gilded Age was bad, we did bring it down for half a century, and then we undid most of that. Drag the slider and watch the curve sag, recover, and sag again.

**Seven centuries of England.** On income, modern Britain is actually less unequal than England around 1801 (Gini 0.47 against 0.51), though the old class tables cannot see inside the top class, so treat their numbers as a floor. That is a mild comfort, but it is a comparison with the start of the Industrial Revolution, not with a golden age.

**Soviet Russia.** In 1968 the richest 1% of Soviet Russia took 3.7% of income, the lowest top-1% share of any society here with full percentile data. In 2025 it is about 24%. Inequality is a policy outcome as much as a fact of nature, which is also a little reassuring and a little not.

**Before written records.** The oldest points are not income at all but the sizes of houses excavated from archaeological sites, from the work of Tim Kohler and colleagues. Çatalhöyük looks quite equal (a Gini of about 0.28), the Kalahari !Kung San are the most equal in the dataset (0.17), and Kahun, the town built for the workers on a Middle Kingdom pyramid, is the most unequal (0.68). Those three numbers are all the source gives, so the curve shape is estimated from the Gini and labelled that way.

## What I took from it

Roughly: the United States today is about as unequal as the Roman Empire at the top, more unequal than Rome at the bottom, and far more unequal in wealth than any income comparison suggests. Things were worse in some places and times. They were not obviously worse in the ones I picked to feel better.

Two caveats matter for the question I started with.

First, this is the wrong resolution for a sudden fortune. A Lorenz curve is a statement about the richest 1%, which in the United States is millions of people. A few thousand people becoming enormously rich in a year barely moves it. What would move San Francisco is local: housing, rents and the relative price of everything for the people who did not get a piece. None of that is in here, and I have no city-level data for any of these societies.

Second, I have not drawn any conclusions about *causes*. These curves tell you how unequal a society was, not whether it was stable, fair or happy. Plenty of very unequal societies were quiet for a long time, and some quite equal ones were not.

## What to keep in mind about the data

Not all of these curves are the same kind of evidence. The label on each card says which:

- **Measured percentiles** come from tax and survey data, mostly from the [World Inequality Database](https://wid.world). The oldest years are imputed from sparse data. I dropped any year the database itself flags as an imputation from a neighbouring country.
- **Social tables** are historians' reconstructions of income by class, from the Global Price and Income History Group and the Roman and Han estimates. The curve runs in straight lines between classes, so inequality inside a class is invisible.
- **Published shares** are a handful of brackets (deciles, top 5%, top 1%), as for medieval English wealth.
- **Shape estimated from Gini** is exactly that. For the archaeological sites all the source gives is one number, so the curve is a smooth lognormal one with that Gini.

Net wealth can be negative, and in a few countries it is for the poorest tenth, which is why some wealth curves dip below zero and why a country like Sweden can show an extreme wealth Gini (0.98 in 2012) that mostly reflects household debt at the bottom, not a society of the very rich. I kept Sweden out of the wealth example for that reason.

Every card has a "Source & notes" link with the citation, what the number measures, and the licence. I checked each reconstructed curve against the Gini its source published. Almost all match to within a tenth of a point. The exceptions are Brazil in 1872 (about a point high) and the Roman and Han curves, which come out about 1.2 and 1.5 points below the published empire-wide Gini because I draw them from the paper's merged summary table. The cards show both numbers.

If you see something that looks wrong, it probably deserves a source check, and I would love to hear about it.
