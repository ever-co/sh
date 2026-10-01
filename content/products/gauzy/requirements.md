---
title: Ever Gauzy requirements
description: What a server needs to run Ever Gauzy.
slug: requirements
order: 40
sources:
  - repo: ever-co/ever-gauzy
    path: README.md
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
  - repo: ever-co/ever-gauzy
    path: docker-compose.yml
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
verified: 2026-10-01
---

- A 64-bit Linux server or VM with Docker Engine and the Docker Compose plugin (v2.20 or later).
- PostgreSQL: included in the Compose setup, or your own managed PostgreSQL.
- A domain name and TLS in front of the web app and the API for anything beyond a local trial.

Sizing depends on the number of users and the modules you use: start small and measure. Every
setting is documented at [docs.gauzy.co](https://docs.gauzy.co).
