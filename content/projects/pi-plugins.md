---
title: "Pi Plugins"
date: "2026-10-10"
categories: ["coding-agents", "pi", "typescript", "developer-tools"]
topics: ["agent-tooling"]
description: "A modular workspace for coding with Pi: plan deliberately, delegate work, keep context useful, and review changes in the conversation. Thirty-two selectable extensions, one suite."
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

Pi Plugins is my answer to those surrounding problems: **32 selectable extensions for [Pi](https://pi.dev), distributed as one Git package**. It is not a new agent or a fork of Pi. It brings the tools I use around the agent into one suite, while keeping each capability optional.

The organizing idea is a continuous workflow rather than a wall of commands. Start with a plan and the questions that actually need your judgment. Delegate bounded work and let long-running jobs report back. Keep cost and context visible. Review the result where the conversation happened, then carry the useful parts into the next step.

## Run and coordinate

- **[pi-bg](/projects/pi-bg)** runs shell jobs and persistent services, with logs, readiness signals and completion wake-ups. Waiting is part of the agent's turn, not an excuse to declare the work finished.
- **[pi-todo](/projects/pi-todo)** keeps a persistent checklist of logical tasks and their dependencies, separate from the processes that carry them out.
- **[pi-subagents](/projects/pi-subagents)** runs bounded tasks in fresh or forked contexts, individually, in parallel, or in a chain.
- **[pi-herdr](/projects/pi-herdr)** connects an interactive Pi session to Herdr, including pane metadata and interactive child sessions for work you want to take over yourself.
- **[pi-recap](/projects/pi-recap)** leaves one line on where a session stands for when you come back to it.
- **[pi-marimo](/projects/marimo-for-agents)** follows live marimo notebooks, bringing running cells, errors, and stale state into the agent's working context.
- **[pi-sidebar](/projects/pi-sidebar)** opens a read-only side chat beside a working session, on its prompt cache, for questions that should not interrupt it.
- **[pi-reload-all](/projects/pi-reload-all)** reloads every Pi session, here and on Herdr's other machines, once each is idle.
- **[pi-mcp-device-login](/projects/pi-mcp-device-login)** signs in to OAuth MCP servers with a device code when the browser is somewhere else.

The pieces cooperate when they are enabled together. Background jobs, subagents, planners and session-owned Herdr children share activity views, with notebook activity participating in the same waiting workflow. Stopping remains explicit and per item; `/stop` remains shell-only. Herdr is an optional integration, not a prerequisite for running the suite.

## Think and review

- **[pi-plan-mode](/projects/pi-plan-mode)** creates space for read-only planning before implementation. One or two planners can explore an approach; the main session is where you reconcile it and choose how to proceed.
- **[pi-ask-user-question](/projects/pi-ask-user-question)** gives decisions a structured dialog, with previews, notes and free-text answers, instead of burying options in prose.
- **[pi-diff-review](/projects/pi-diff-review)** opens a full-screen diff with line comments and suggested edits that go back to the agent as a review message.
- **[pi-rewind](/projects/pi-rewind)** restores files alongside conversation rewinds, so returning to an earlier discussion also has a corresponding working-tree state.
- **[pi-tool-gate](/projects/tool-gate)** handles tool approval through fixed rules, Jev judgments for less clear-cut cases, and escalation to you when needed.

Closing a diff never marks it reviewed. Per-file checklist actions and the explicit `:mark` command distinguish inspection from recorded review. Review and recovery are part of the work loop, not cleanup after the agent has left.

## Context and cost

- **[pi-cache-guard](/projects/cache-guard)** makes expensive cache misses visible before you send a prompt. With Jev configured, it also trims large tool results and helps compact conversations. Cache warming itself is handled by Pi, not this extension.
- **[pi-auto-effort](/projects/auto-effort)** uses Jev to assess how demanding a prompt is and adjust reasoning effort within the ceiling you chose.
- **[pi-status-footer](/projects/pi-status-footer)** brings project, branch, model, context, cost, and plan limits together.
- **[pi-context](/projects/pi-context)** shows what fills the context window, with previews of what the model receives.
- **[pi-trends](/projects/pi-trends)** charts context, effort, tokens and cost model call by model call.
- **[pi-pressure](/projects/pi-pressure)** appears only while the machine itself is under CPU, memory or thermal pressure.

The goal is not to hide every interruption. It is to reserve interruptions for choices that deserve attention, while keeping the cost of a long session legible.

## Terminal and editing

- **[pi-vim](/projects/pi-vim)** edits the prompt modally; **[pi-stash](/projects/pi-stash)** sets a draft aside while you run a command; **[pi-copy](/projects/pi-copy)** copies a useful fragment instead of a whole reply; **[pi-next-prompt](/projects/next-prompt)** offers an editable next step when the continuation is obvious, and never sends it for you.
- **[pi-cc-render](/projects/pi-cc-render)** renders compact tool cards, rich diffs and thinking summaries; **[pi-markdown-extras](/projects/pi-markdown-extras)** draws diagrams and admonitions; **[pi-prose-width](/projects/pi-prose-width)** keeps prose readable without squeezing code blocks and tables; **[pi-sticky-last-prompt](/projects/pi-sticky-last-prompt)** keeps the prompt you scrolled past in view.
- **[pi-select-nav](/projects/pi-select-nav)** adds consistent picker navigation; **[pi-clear-screen](/projects/pi-clear-screen)** clears the visible transcript without losing history; **[pi-appearance-resync](/projects/pi-appearance-resync)** follows the terminal's light/dark appearance; **[pi-herdr-scrollbar-width](/projects/pi-herdr-scrollbar-width)** accounts for Herdr's scrollbar when laying out the exit transcript.

One editor integration point keeps focus, cursor and modes consistent across the main prompt and embedded dialogs. Ctrl+U/D scroll in idle Normal mode and read-only viewers, not while editing text. Ctrl+L clears the viewport after explicitly moving Pi's model picker to Alt+P, with Alt+M as an alias.

## Install one package, choose your workspace

```sh
pi install git:github.com/justmytwospence/pi-plugins
```

The Git package enables **all 32 extensions by default**. Run `pi config` to disable the ones you do not want, then `/reload` in Pi to apply the selection. Selecting components changes what loads; it does not remove their files.

There is **one suite version**. A Git tag or commit pins the whole package; components cannot have independent version pins within that managed installation. If you already use the original standalone packages, disable their entries before enabling the suite copies: different physical copies are not deduplicated. Keep the old repositories or checkouts if you need a rollback path.

Selectable does not mean dependency-free. Jev-backed capabilities need access to Jev, and Herdr and marimo integrations need their respective tools. The [documentation](https://pi-plugins.vercel.app) covers setup and configuration; the [suite repository](https://github.com/justmytwospence/pi-plugins) retains each component's source, README and license. Several components began elsewhere (pi-todo, pi-vim, pi-stash, pi-sticky-last-prompt, pi-cc-render, pi-markdown-extras, pi-context, and pi-plan-mode); each keeps its upstream attribution.

## One portfolio story, not one implementation for every harness

The [cache-guard](/projects/cache-guard) idea also runs in Codex, through a separate repository linked from that page. That port is not part of this Pi package.

[lean-context](/projects/lean-context) is a retired predecessor, not a selectable component. Its Pi functionality now lives in cache-guard. The original repositories remain useful history, not additional packages to enable alongside the suite.

The boundary is intentional: [pi-brokered-auth](/projects/pi-brokered-auth), [tmux-agents](/projects/tmux-agents), [Herdr machine management](/projects/herdr-machine0), the Herdr plugins, and [anthropic-billing-guard](/projects/anthropic-billing-guard) remain separate projects. Pi Plugins is the in-session workspace, not all of the infrastructure around it.
