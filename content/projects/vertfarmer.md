---
title: "VertFarm"
date: "2024-11-15"
categories: ["web-app", "typescript", "react", "wasm"]
topics: ["endurance", "web-apps"]
description: "Plan terrain-aware routes in the browser: drop waypoints on a topo map and a Rust + WebAssembly pathfinder respects your maximum slope and avoids aspects you choose, client-side."
featured: true
type: "external"
externalUrl: "https://vertfarm.app"
links:
  - label: "Live"
    url: "https://vertfarm.app"
---

VertFarm plans backcountry ski routes that take avalanche terrain into account. Place waypoints and it routes each leg over real terrain: skin tracks stay under your steepest grade, prefer a comfortable one and switchback where they have to, and descents respect the steepest slope you will ski. Mark the aspects and elevation bands to avoid, or import them from the day's avalanche.org forecast, and routes stay out of release terrain and, as far as you ask, out of the runout below it.

This is a planning aid, not a safety tool. Elevation models miss small features, and wind loading, snowpack and forest cover are not modelled. Read the current forecast and make your own decisions in the field.

## What it does

- **Slope-angle shading** anywhere on the map (27-29°, 30-34°, 35-39°, 40-44°, 45°+), computed in the browser from terrain tiles.
- **Avalanche terrain.** Release areas are slopes of 30° or steeper (adjustable) whose aspect and elevation band fall in the avoided rose. Runout is modelled by propagating debris downslope until the energy line from the release point drops to the alpha angle, after [Flow-Py](https://github.com/avaframe/FlowPy).
- **Routing.** A least-time search in Rust compiled to WebAssembly, costed with the Munter method. Skin legs cap the grade along the direction of travel and pay for kick turns, and simplified paths never cut through terrain the router would reject.
- **Route summary.** Distance, gain and loss, Munter time up and down, max grade, steepest terrain crossed, kick turns, the share of the route in release or runout terrain, and an elevation profile coloured by slope.
- **Forecast import** (US). Avalanche problems' aspect and elevation roses from avalanche.org, with danger ratings and validity shown verbatim and a link to the full forecast.
- GPX import and export, shareable links, metric or imperial units, 3D terrain.

Everything runs in your browser; there is no server and no account.

## Data and credits

Terrain from [Mapterhorn](https://mapterhorn.com/attribution) and its sources. Basemap from [OpenFreeMap](https://openfreemap.org), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Forecasts from [avalanche.org](https://avalanche.org) and the contributing avalanche centers.

The source is not public.
