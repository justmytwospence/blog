---
title: "Pi Plugins"
date: "2026-10-10"
categories: ["coding-agents", "pi", "typescript", "developer-tools"]
description: "A modular workspace for coding with Pi: plan deliberately, delegate work, keep context useful, and review changes without leaving the conversation. Nineteen extensions, one suite."
featured: true
collection: true
links:
  - label: "Docs"
    url: "https://pi-plugins.vercel.app"
  - label: "GitHub"
    url: "https://github.com/justmytwospence/pi-plugins"
---

# Pi Plugins

A coding agent's model is only part of the experience. The rest is how you give it direction, see what is still running, keep a long conversation useful, and decide whether its changes are worth keeping.

Pi Plugins is my answer to those surrounding problems: **19 selectable extensions for [Pi](https://pi.dev), distributed as one Git package**. It is not a new agent or a fork of Pi. It brings the tools I use around the agent into one suite, while keeping each capability optional.

The organizing idea is a continuous workflow rather than a wall of commands. Start with a plan and the questions that actually need your judgment. Delegate bounded work and let long-running jobs report back. Keep cost and context visible. Review the result where the conversation happened, then carry the useful parts into the next step.

## Shape the work

- **[pi-plan-mode](/projects/pi-plan-mode)** creates space for read-only planning before implementation. One or two planners can explore an approach; the main session is where you reconcile it and choose how to proceed.
- **[pi-ask-user-question](/projects/pi-ask-user-question)** gives decisions a structured dialog instead of burying options in prose.
- **[pi-auto-effort](/projects/auto-effort)** uses Jev to assess how demanding a prompt is and adjust reasoning effort within the ceiling you chose.

These tools separate two things that are easy to conflate: how much the agent should think, and which decisions still belong to you.

## Delegate without losing the thread

- **[pi-subagents](/projects/pi-subagents)** runs bounded tasks in fresh or forked contexts, individually, in parallel, or in a chain.
- **[pi-bg](https://github.com/justmytwospence/pi-plugins/tree/main/packages/pi-bg)** manages shell jobs and persistent services, with logs, readiness signals, and completion notifications. Waiting is part of the agent's turn, not an excuse to declare the work finished.
- **[pi-herdr](https://github.com/justmytwospence/pi-plugins/tree/main/packages/pi-herdr)** connects an interactive Pi session to Herdr, including pane metadata and interactive child sessions for work you want to take over yourself.
- **[pi-marimo](/projects/marimo-for-agents)** follows live marimo notebooks, bringing running cells, errors, and stale state into the agent's working context.

The pieces cooperate when they are enabled together. Background jobs and subagents share a task view; notebook activity can participate in the same waiting workflow. Herdr is an optional integration, not a prerequisite for running the suite.

## Spend context and attention deliberately

- **[pi-cache-guard](/projects/cache-guard)** makes expensive cache misses visible before you send a prompt. With Jev configured, it also trims large tool results and helps compact conversations. Cache warming itself is handled by Pi, not this extension.
- **[pi-tool-gate](/projects/tool-gate)** handles tool approval through fixed rules, Jev judgments for less clear-cut cases, and escalation to you when needed.

The goal is not to hide every interruption. It is to reserve interruptions for choices that deserve attention, while keeping the cost of a long session legible.

## Review, recover, and continue

- **[pi-diff-review](https://github.com/justmytwospence/pi-plugins/tree/main/packages/pi-diff-review)** opens a full-screen diff with line comments and suggested edits that go back to the agent as a review message.
- **[pi-rewind](/projects/pi-rewind)** restores files alongside conversation rewinds, so returning to an earlier discussion also has a corresponding working-tree state.
- **[pi-copy](/projects/pi-copy)** offers a picker for useful material from the session: code, commands, paths, URLs, and more.
- **[pi-next-prompt](/projects/next-prompt)** offers an editable next-step suggestion when the continuation is obvious, rather than making you retype it.

Review and recovery are part of the work loop, not cleanup after the agent has left.

## Make the terminal comfortable

Six smaller extensions address the interface you spend the day looking at: **[pi-status-footer](/projects/pi-status-footer)** brings project, model, context, cost, and plan limits together; **[pi-select-nav](/projects/pi-select-nav)** adds consistent picker navigation; **[pi-clear-screen](/projects/pi-clear-screen)** clears the visible transcript without losing history; **[pi-appearance-resync](/projects/pi-appearance-resync)** follows the terminal's light/dark appearance; **[pi-herdr-scrollbar-width](/projects/pi-herdr-scrollbar-width)** accounts for Herdr's scrollbar when laying out the exit transcript; and **[pi-prose-width](https://github.com/justmytwospence/pi-plugins/tree/main/packages/pi-prose-width)** keeps prose readable without squeezing code blocks and tables.

## Install one package, choose your workspace

```sh
pi install git:github.com/justmytwospence/pi-plugins
```

The Git package enables **all 19 extensions by default**. Run `pi config` to disable the ones you do not want, then `/reload` in Pi to apply the selection. Selecting components changes what loads; it does not remove their files.

There is **one suite version**. A Git tag or commit pins the whole package; components cannot have independent version pins within that managed installation. If you already use the original standalone packages, disable their entries before enabling the suite copies: different physical copies are not deduplicated. Keep the old repositories or checkouts if you need a rollback path.

Selectable does not mean dependency-free. Jev-backed capabilities need access to Jev, and Herdr and marimo integrations need their respective tools. The [documentation](https://pi-plugins.vercel.app) covers setup and configuration; the [suite repository](https://github.com/justmytwospence/pi-plugins) retains each component's source, README, license, and imported revision in `source-pins.json`.

## One portfolio story, not one implementation for every harness

Several ideas also have Claude Code, opencode, or Codex ports. Their links remain on the [auto-effort](/projects/auto-effort), [cache-guard](/projects/cache-guard), [marimo for agents](/projects/marimo-for-agents), [next-prompt](/projects/next-prompt), and [tool-gate](/projects/tool-gate) pages. Grouping them here describes a shared body of work; those ports remain separate repositories and are **not** part of this Pi package.

[lean-context](/projects/lean-context) is a retired predecessor, not a twentieth component. Its Pi functionality now lives in cache-guard. The original repositories remain useful history, not additional packages to enable alongside the suite.

[pi-brokered-auth](/projects/pi-brokered-auth) is a related authentication experiment, grouped here for the portfolio but not bundled in the nineteen-extension suite.

The boundary is intentional: [tmux-agents](/projects/tmux-agents), [Herdr machine management](/projects/herdr-machine0), [Herdr navigation](/projects/herdr-repeat-navigation), and [anthropic-billing-guard](/projects/anthropic-billing-guard) remain separate projects. Pi Plugins is the in-session workspace, not all of the infrastructure around it.
