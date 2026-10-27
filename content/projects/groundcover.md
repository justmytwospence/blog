---
title: "GroundCover"
date: "2026-08-06"
categories: ["typescript", "deck.gl", "maplibre", "strava", "web-app"]
topics: ["endurance", "web-apps", "fun"]
description: "Strava counts every mile you log; this counts the ground those miles actually cover — 10,639 logged miles resolved to 3,975 miles of distinct road and trail, computed and drawn entirely in your own browser."
featured: true
type: "external"
externalUrl: "https://groundcover.spencerboucher.com"
links:
  - label: "Live"
    url: "https://groundcovermap.vercel.app"
  - label: "My map"
    url: "https://groundcover.spencerboucher.com"
---

**How much ground have you *actually* covered?**

Strava adds up every mile you log. It never tells you how much of the world those miles cover: how much distinct road and trail your feet have genuinely been on, counting the loop you have run two hundred times exactly once. One real history: **10,639 miles logged, 3,975 miles of actual ground.**

GroundCover works that number out from your GPS and draws it. Ground covered once glows gold; ground worn into a groove fades to blue. Scrub through time and watch your map fill in, one route drawing itself at a time.

## Your history never leaves your browser

There is no server, no account and no database. Activities download straight from Strava into your tab, and everything is computed and stored on your own machine. Nobody, including whoever deployed it, can see your map. The site's Content-Security-Policy allows connections only to Strava and the basemap, so even a stray analytics snippet would be blocked by your browser rather than send GPS anywhere. Tokens are never logged or put in a URL.

## The algorithm

Deduplicating GPS is harder than it looks. Two runs down the same street never share coordinates; GPS wanders by ten metres and back. Snapping to a grid double-counts a road crossed at an angle, and merging nearby points slowly eats a whole city.

GroundCover resamples every activity to a point every 8 m and keeps an append-only record of *sites* in chronological order. Within 20 m of an existing site with a compatible bearing is a repeat; beyond 30 m is new ground; **20-30 m is a deliberate dead zone**, a hysteresis brake that stops GPS jitter from slowly accreting phantom mileage. A separate route alongside (a trail beside a road) that keeps its distance for 250 m is new ground even inside 30 m. Credit is chronological: whoever reached ground first gets it.

## Bring your own Strava credentials

Strava counts rate limits per application, so one shared registration would run dry after a handful of people. You register your own Strava API application, which removes that ceiling and means the project holds no one else's secrets. Strava allows one callback domain per app and you do not need to change yours: leave it as `localhost`, copy the address you land on after authorizing, and paste it back.

Not affiliated with Strava. The source is not public.
