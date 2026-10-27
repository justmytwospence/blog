---
title: "IFS Journal"
date: "2024-11-15"
categories: ["web-app"]
topics: ["web-apps"]
description: "The journaling that helps you understand yourself"
featured: true
type: "external"
externalUrl: "https://ifsjournal.me"
links:
  - label: "Live"
    url: "https://ifsjournal.me"
---

IFS Journal is a journaling app for [Internal Family Systems](https://ifs-institute.com) work. You write entries; Claude finds the "parts" speaking through your writing (Managers, Firefighters, Protectors, Exiles) and anchors each one to the exact passages it came from.

## How it works

- **Grounded in your words.** Every part the model names is backed by cited passages from your journal, never free-form inference, using Anthropic's [Citations API](https://docs.claude.com/en/docs/build-with-claude/citations).
- **Citations that survive edits.** Highlights are anchored the way [Hypothesis](https://hypothes.is/) anchors annotations (W3C text-quote and text-position selectors with a fuzzy fallback), so editing an entry does not break them.
- **Measured, not vibes.** Extraction quality is tracked against synthetic personas, each with an intended cast of parts and 40 entries, from terse logbook writers to long-form introspection. Every model or prompt change is replayed against the same frozen entries and graded.
- **Private by default.** Every request is scoped to the signed-in user; nobody else can read your entries.

The source is not public.
