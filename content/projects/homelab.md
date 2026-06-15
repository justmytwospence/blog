---
title: "Homelab"
date: "2026-06-09"
categories: ["homelab", "self-hosted", "docker", "infrastructure", "networking"]
description: "A self-hosted homelab running 80+ Dockerized services behind OPNsense, Traefik, WireGuard, Pi-hole, and Authelia — media, photos, documents, monitoring, home automation, and a few full crypto nodes."
featured: true
---

# Homelab

A single Docker host quietly running my digital life: **80+ self-hosted services** behind a hardened edge, reachable from anywhere over an encrypted tunnel, and backed up on a schedule. The entire setup is declarative Docker Compose under version control, so it's reproducible from a clean machine.

## Edge and networking

Everything sits behind an OPNsense firewall and a **Traefik** reverse proxy that terminates TLS with a wildcard `*.spencerboucher.com` certificate, issued automatically through Let's Encrypt's DNS challenge. **Pi-hole** runs DNS (and network-wide ad-blocking), **WireGuard** provides secure remote access when I'm away from home, and **Authelia** adds single sign-on in front of the services.

Routing rules split the world cleanly in two: a handful of services are exposed to the public internet, while everything else resolves only on the LAN or over the VPN — anything that doesn't match simply returns a 404 rather than hinting that it exists.

## What it runs

- **Media & library** — Jellyfin and Plex, the full *arr stack, audiobookshelf, calibre-web, and Immich for photos
- **Documents & knowledge** — Nextcloud, Paperless, a wiki, and read-later/bookmarking tools
- **Monitoring & ops** — Prometheus, Grafana, Netdata, and Beszel for metrics, dashboards, and uptime
- **Security** — CrowdSec and fail2ban watching the edge, Bitwarden for secrets
- **Automation** — n8n workflows, scheduled jobs, and a self-hosted MCP gateway
- **Crypto** — full Bitcoin, Monero, and Ethereum (execution + consensus) nodes

## Why

It's part utility, part playground. Owning the whole stack — DNS, TLS, auth, reverse proxy, backups — is the best way I've found to actually understand how production infrastructure fits together, and it keeps my data mine.
