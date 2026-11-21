---
title: "uphill.ski"
date: "2024-11-15"
categories: ["web-app", "typescript", "react", "rust", "wasm", "maplibre"]
topics: ["endurance", "web-apps"]
kind: "app"
description: "An avalanche-aware backcountry ski route planner. Click a start and a summit and it routes the tour over real terrain, around the avalanche terrain today's forecast flags. In your browser, offline too."
featured: true
featuredOrder: 1
image: "/project-images/uphill-ski.webp"
imageAlt: "A ski tour planned on a 3D map, with avalanche terrain shaded"
sourcePrivate: true
type: "external"
externalUrl: "https://uphill.ski"
links:
  - label: "Live"
    url: "https://uphill.ski"
  - label: "Docs"
    url: "https://uphill.ski/docs"
---

uphill.ski plans backcountry ski tours that take avalanche terrain into account. Click a start and a summit and it routes the tour over real terrain: skin tracks stay under your steepest grade and switchback where they must, descents ski the fall line within the steepest slope you will ski, and the line keeps out of the avalanche terrain you mark to avoid or that today's forecast flags. It began as VertFarm.

This is a planning aid, not a safety tool. Elevation models miss small features, cornices and cliffs, and wind loading and snowpack are not modelled. Read the current forecast, carry rescue gear and make your own decisions in the field.

## What it does

- **Routing.** A least-time search in Rust compiled to WebAssembly, costed in travel time from pace curves (Munter, or your own for skinning). Skin legs cap the grade along the direction of travel and pay for kick turns, and skins on and off are inferred from the terrain.
- **Avalanche terrain.** Release areas are slopes at or above the release angle (30° by default) whose aspect and elevation band are avoided. Runout is modelled by propagating debris downslope until the energy line from the release point drops to the alpha angle, after [Flow-Py](https://github.com/avaframe/FlowPy). Release terrain is never entered, and runouts are avoided when you ask.
- **Today's forecast** (US). The avalanche.org forecast loads automatically and sets the aspects and elevation bands to avoid, with danger ratings and a link to the full forecast.
- **Slope-angle shading** anywhere on the map (27-29°, 30-34°, 35-39°, 40-44°, 45°+), with contours, national topo maps, imagery and 3D terrain.
- **Route summary.** Distance, gain and loss, time up and down, kick turns, steepest grade, and the share of the route in release or runout terrain, with an elevation profile.
- **Take it with you.** Share links and QR codes carry the route and its settings, GPX goes in and out, and a saved route's maps and terrain follow it offline, so you can re-route with no signal.

It runs in your browser, works offline after the first visit and needs no account. The [docs](https://uphill.ski/docs) go into more detail.

## Data and credits

Terrain from [Mapterhorn](https://mapterhorn.com/attribution) and its sources. Basemap from [OpenFreeMap](https://openfreemap.org), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Forecasts from [avalanche.org](https://avalanche.org) and the contributing avalanche centers.

The source is not public.
