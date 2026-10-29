---
title: "OpenCode Plugins"
date: "2026-10-13"
categories: ["coding-agents", "opencode", "typescript", "developer-tools"]
topics: ["agent-tooling"]
description: "The Pi Plugins ideas ported to OpenCode 2: background work, subagents, diff review, cache and context awareness, tool gating, effort control. Sixteen plugins, one Git commit."
collection: true
links:
  - label: "GitHub"
    url: "https://github.com/justmytwospence/opencode-plugins"
---

# OpenCode Plugins

OpenCode Plugins is the [OpenCode](https://opencode.ai) 2 sibling of [Pi Plugins](/projects/pi-plugins): **16 plugins in one repository**, each enabled on its own and all pinned to the same commit. It replaces the standalone `opencode-*` repositories I started with, which are now archived.

Each plugin is a port of a Pi component, so the Pi pages describe the ideas; this suite carries them over where OpenCode's plugin and terminal APIs allow, and talks between plugins through OpenCode's plugin RPC rather than Pi's event bus.

## Run and coordinate

- **opencode-bg**: background jobs and services with `bg_run` / `bg_wait`, wake-ups when a job ends or a service is ready, and a `/bg` panel. Port of [pi-bg](/projects/pi-bg).
- **opencode-subagents**: a delegate tool for parallel tasks, chains, worktree isolation, forked context and async results, with Jev picking the agent, model tier and effort. Port of [pi-subagents](/projects/pi-subagents).
- **opencode-herdr**: interactive OpenCode children in herdr tabs, splits or worktrees, the session's title and model in herdr's sidebar, and PR status on spaces. Port of [pi-herdr](/projects/pi-herdr).
- **opencode-btw**: `/btw` asks a side question in a separate session while the main agent keeps working. The Pi counterpart is [pi-sidebar](/projects/pi-sidebar).
- **opencode-marimo**: follows your live marimo notebook. Port of [marimo for agents](/projects/marimo-for-agents).

## Review and control

- **opencode-diff-review**: a diff panel with vim keys, line comments and suggested edits sent back to the agent as one message. Port of [pi-diff-review](/projects/pi-diff-review).
- **opencode-tool-gate**: fixed rules, Jev for the gray zone, one push-back, then OpenCode asks you; Claude Code-style permission modes per session. Port of [tool-gate](/projects/tool-gate).
- **opencode-auto-effort**: sets the effort variant per prompt with Jev. Port of [auto-effort](/projects/auto-effort).

## Context and cost

- **opencode-cache-guard**: asks before a prompt that would re-cache a large Anthropic conversation, shows the cache's time left, and with Jev trims large tool output and compacts a cold cache. Port of [cache-guard](/projects/cache-guard), and the successor to [lean-context](/projects/lean-context)'s opencode port.
- **opencode-context**: `/context` shows where the context window goes. Port of [pi-context](/projects/pi-context).
- **opencode-status-footer**: Git marks beside the branch, and Claude and Codex subscription windows in the sidebar. Port of [pi-status-footer](/projects/pi-status-footer).

## Terminal

- **opencode-next-prompt** ([next-prompt](/projects/next-prompt)), **opencode-copy** ([pi-copy](/projects/pi-copy)), **opencode-prose-width** ([pi-prose-width](/projects/pi-prose-width)), **opencode-markdown-extras** ([pi-markdown-extras](/projects/pi-markdown-extras)) and **opencode-sticky-last-prompt** ([pi-sticky-last-prompt](/projects/pi-sticky-last-prompt)).

## Install

Add the plugins you want to `plugins` in `~/.config/opencode/opencode.jsonc`, every one pinned to the same full commit hash:

```jsonc
{
  "plugins": [
    "opencode-tool-gate@github:justmytwospence/opencode-plugins#<commit>::path:packages/opencode-tool-gate"
  ]
}
```

OpenCode loads a plugin's terminal half automatically; plugins that only have a terminal half go in `~/.config/opencode/cli.json` instead. OpenCode keeps an exact commit fixed and checks branches for updates, so pin the hash.
