---
title: "Pacing"
date: "2025-12-02"
categories: ["bayesian", "pymc", "python", "running"]
topics: ["bayesian", "endurance"]
description: "A Bayesian model for ultramarathon pacing — turns a course's elevation profile and your fitness into a data-driven pacing strategy."
---

# Pacing

A Bayesian model of how I move over mountain terrain, built toward ultramarathon pacing plans: given a course's elevation profile and current fitness, how fast should each section go?

## The model

- **Data.** Second-by-second streams (speed, elevation, heart rate, cadence) parsed from a Strava export's FIT files into DuckDB, then cut into 20-second segments. Fixed-time segments rather than fixed-distance ones give slow, steep climbs more observations instead of compressing them into a few.
- **Latent effort.** Each segment has an expected effort that drives speed through gradient. Heart rate is a second, noisy observation of that effort, with its own lag and drift over a long day, not the definition of effort itself.
- **Inference.** Written in PyMC, with prior predictive checks before fitting and convergence diagnostics after.

Status: an exploratory model, not yet a pacing tool. The source is not public.
