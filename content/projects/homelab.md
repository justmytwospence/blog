---
title: "Homelab"
date: "2026-06-09"
categories: ["homelab", "self-hosted", "docker", "infrastructure", "networking", "coding-agents", "mcp"]
topics: ["homelab"]
description: "A single-host homelab running 50+ Docker Compose stacks behind OPNsense, Traefik and Authelia: media, documents, monitoring, a home for coding agents and self-hosted MCP servers."
featured: true
---

# Homelab

A single Docker host quietly running my digital life: **50+ Compose stacks and about 160 containers** behind a hardened edge, reachable from anywhere over an encrypted tunnel, and backed up every night. The entire setup is declarative Docker Compose under version control, so it's reproducible from a clean machine.

## Edge and networking

Everything sits behind an OPNsense firewall and a **Traefik** reverse proxy that terminates TLS with a wildcard `*.spencerboucher.com` certificate, issued automatically through Let's Encrypt's DNS challenge. **Pi-hole** runs DNS (with network-wide ad-blocking and split-horizon names), **WireGuard** provides remote access when I'm away from home, and **Authelia** adds single sign-on in front of the services. CrowdSec watches the edge and blocks at Traefik.

Every route falls into one of four access tiers: VPN plus SSO for human UIs, public plus SSO, public with the app's own auth (the MCP servers, behind OAuth or bearer tokens), and VPN-only endpoints for native apps. Anything that matches none of them returns a 404 rather than hinting that it exists.

## What it runs

- **Media and library**: Plex, the *arr suite, Immich for photos, and Grimmory with Audiobookshelf for books
- **Documents and knowledge**: Paperless with WebDAV shares, a headless Obsidian vault, Karakeep for bookmarks, Syncthing and SFTPGo for files
- **Monitoring and ops**: Grafana over InfluxDB and Telegraf, Beszel, Uptime Kuma with monitors as code, and Komodo as an ops view; alerts land in a private Matrix room
- **Automation**: n8n workflows, a recreation.gov permit watcher, and a few small services built here (Amazon receipts for YNAB, Apple Reminders over iCloud)
- **Coding agents**: an AgentBox hub for sandboxed agents, the herdr web client, Paseo and OpenCode servers, a marimo notebook hub, and [telebrowser](/projects/telebrowser) for agents that need a real browser
- **MCP servers**: my own [Strava](/projects/strava-mcp), [Garmin](/projects/garmin-mcp), [YNAB](/projects/ynab-mcp), [Inoreader](/projects/inoreader-mcp), [Hardcover](/projects/hardcover-mcp), [Paperless](/projects/paperless-mcp), [MinusPod](/projects/minuspod-mcp) and [backup](/projects/backup-mcp) servers, plus upstream ones for Todoist, Hevy, Grafana and the media stack, all behind OAuth or bearer tokens

## Keeping it current

Image updates are handled by **[shipshape](/projects/shipshape)**, a bot I wrote for exactly this setup: it polls the registries, opens a real GitHub pull request for each new tag, has Claude find and read the upstream changelog, auto-merges what policy allows, and deploys with a true `docker compose up -d`.

When a service needs a fix upstream hasn't released yet, I send the fix upstream and run a fork in the meantime: the release we already run plus the cherry-picked fix, built from a pinned commit. shipshape replays that fork onto each new upstream release and drops the commits upstream has taken, so the fork retires itself. The first case was a Kobo reading-statistics fix for Grimmory.

Every stack with state is in a nightly encrypted backup to Backblaze B2, with a restore runbook in the repository.

## Why

It's part utility, part playground. Owning the whole stack (DNS, TLS, auth, reverse proxy, backups) is the best way I've found to actually understand how production infrastructure fits together, and it keeps my data mine. Lately it is also where my coding agents live: always on, close to the data, and one SSH hop from every machine I use.
