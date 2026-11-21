---
title: "Centered vs Non-Centered Parameterizations"
date: "2026-02-09"
categories: ["bayesian-statistics", "MCMC", "hierarchical-models"]
description: "Interactive exploration of how reparameterization transforms difficult posterior geometries into shapes that MCMC samplers can navigate efficiently."
component: "CenteredVsNoncentered"
featured: true
---

# Centered vs Non-Centered Parameterizations

Hierarchical models can produce posteriors with a funnel in them, and a funnel is hard for an MCMC sampler to explore: the step size that works in the wide part is far too big for the narrow neck. Reparameterizing the model, so the sampler works on a standardized version of the parameters, can turn the funnel into something much friendlier without changing the model at all.

Play with the controls below to see how the geometry changes between the centered and non-centered forms.

<!--viz-->
