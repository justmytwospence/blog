---
title: "Herdr plugins"
date: "2026-10-28"
categories: ["coding-agents", "herdr", "python"]
topics: ["agent-tooling"]
kind: "plugin-suite"
description: "Six small plugins for herdr, the terminal multiplexer for coding agents: git status on every space, undo for closed panes, a smarter agent cycle, sorted spaces, AgentBox boxes as spaces, and a worktree reaper."
collection: true
links:
  - label: "GitHub"
    url: "https://github.com/justmytwospence/herdr-plugins"
---

# Herdr plugins

[Herdr](https://herdr.dev) is a terminal multiplexer built for running many coding agents at once. These are the small plugins I wrote around it, one per directory of a single repository. Each is installed, enabled and bound on its own; they share only the repository and a socket client.

- **[git-status](/projects/herdr-git-status)** puts compact Git state (`* ↑N ↓N !`) on every space, worktree children included, and never shows a falsely clean result.
- **[undo](/projects/herdr-undo)** reopens the last closed pane, tab or space with its layout, directories and labels, and resumes the agent sessions that were running there.
- **[cycle](/projects/herdr-cycle)** orders the agents list so that one key visits what needs you first: blocked agents, then sessions whose prompt cache is about to expire, then finished agents you have not looked at.
- **[sort-spaces](/projects/herdr-sort-spaces)** sorts spaces alphabetically.
- **[agentbox](/projects/herdr-agentbox)** shows one space per AgentBox box the hub owns, with the box agent's live state in the sidebar.
- **[worktree-reaper](/projects/herdr-worktree-reaper)** removes worktrees whose branch has landed, with their space and branch, once nothing is working there.

## Install

```sh
herdr plugin install justmytwospence/herdr-plugins/<plugin> --ref <commit> --yes
```

The plugins need Python 3.9 or later and use only the standard library. git-status, undo and agentbox began as separate repositories and were folded in here.
