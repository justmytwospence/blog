---
title: "Switchyard"
date: "2026-11-02"
categories: ["coding-agents", "pi", "typescript", "self-hosted", "pwa"]
topics: ["agent-tooling"]
kind: "tool"
featured: true
featuredOrder: 8
image: "/project-images/switchyard.webp"
imageAlt: "The Switchyard board of branches by status, with a phone in front answering a question a Pi session asked"
description: "Run Pi coding agents on your own machines and drive them from your phone, browser or terminal. A coordinator tracks branches, sessions, GitHub issues and schedules; hosts dial out, so nothing needs an open port."
type: "external"
externalUrl: "https://switchyard-site.pages.dev"
links:
  - label: "Docs"
    url: "https://switchyard-site.pages.dev"
  - label: "GitHub"
    url: "https://github.com/justmytwospence/switchyard"
---

Switchyard runs [Pi](https://github.com/earendil-works/pi) coding agents on your laptop, workstation or home server, and lets you follow every session from your phone, your browser or your terminal. The agents stay where the repositories, toolchains and logins are; you can answer the question one asks from the train and take over in a terminal when you sit down.

- **Your machines, every screen.** Hosts run Pi as you and dial out to a coordinator, so they need no open ports. Phone, browser and terminal show the same live session, and closing one never stops the work.
- **Questions become cards.** When Pi or a plugin asks something, the question shows in every client and as a notification on the device you are using. Answer once, anywhere.
- **Work before there is a session.** GitHub trackers feed a board: issues assigned to you wait in Not started, starting one creates its worktree and session, and the branch follows its pull request to review and merge.
- **Terminals are first-class.** Every session runs Pi's own TUI, and a herdr or tmux session can mirror Switchyard, a tab per active branch.

`switchyard up` runs the coordinator and a host in one process on a single machine; for more, run the coordinator as a server and enroll each machine as a host.
