---
title: "Bikefitter"
date: "2026-11-17"
categories: ["web-app", "typescript", "svelte", "cycling"]
topics: ["endurance", "web-apps"]
kind: "app"
description: "See how a road or gravel bike fits you: enter your height and inseam, pick a frame and watch your position on it. Compares sizes and more than 500 bikes. Runs in your browser."
featured: true
featuredOrder: 3
image: "/project-images/bikefitter.webp"
imageAlt: "A rider drawn on a road bike with knee, hip and torso angles marked, beside the rider settings"
type: "external"
externalUrl: "https://bikefitter.app"
links:
  - label: "Live"
    url: "https://bikefitter.app"
  - label: "GitHub"
    url: "https://github.com/justmytwospence/bikefit"
  - label: "Model notes"
    url: "https://github.com/justmytwospence/bikefit/blob/dev/docs/model.md"
---

Bikefitter is a bike fit explorer for road and gravel. Enter your body, pick a frame, then change the fit and watch the whole layout respond. Every number is linked to the drawing: hover a knee angle and the drawing shows where it is measured.

## Two questions

- **Fit my bike** takes the bike you ride and works out what to change. It offers three targets worked out from your current setup: what you can do with tools (saddle, spacers, cleats), with new parts (also stem and seatpost), or with everything (also cranks), each with a score, so you can see what new parts would buy you.
- **Find a bike** ranks a catalog of manufacturer geometry for drop-bar bikes from 2018 on by how close each gets you to your ideal position with the parts it is sold with. It marks your size, and says so when you are between sizes.

## What is modelled

Feet, pelvic tilt, effective seat angle, hand load at your effort level, knee angle at the top of the stroke, a second pose on the drops, and toe overlap. Where published measurements exist the model's constants come from them rather than from tuning the output, and the model is then checked against independent published observations of saddle height and knee angle. The [model notes](https://github.com/justmytwospence/bikefit/blob/dev/docs/model.md) list each constant, its source and how strong the evidence is.

Your measurements and bikes stay in your browser. It is a starting point, not a substitute for a professional fit.
