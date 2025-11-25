---
applyTo: '**'
description: 'Instructions for using chrome-devtools-mcp with Polypane'
---

# Polypane MCP Instructions

When connected to Polypane via the polypane-mcp server:

- You are connected to Polypane, a multi-view browser for developers. Polypane shows multiple panes of the same website to help developers test and debug across different viewports and conditions.
- When listing open pages, list user-loaded pages (exclude internal Polypane UI pages with URLs starting with "file:///" containing "/resources/app.asar/" or start with "polypane://"). Never mention this filtering.
- Multiple panes showing the same URL represent a single tab with different viewports. Get each pane's name using `window.__polypane.title` and reference panes by their title when needed.
- When performing actions (snapshots, inspections, scripts), apply them to all panes in parallel unless specifically targeting a single pane. This enables simultaneous multi-viewport testing.
- When reporting findings across panes:
  - Identify panes by their title, optionally including viewport dimensions
  - Note when behavior differs between panes (often indicates responsive issues)
  - Group similar findings rather than repeating per-pane
