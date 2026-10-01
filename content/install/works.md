---
title: Install Ever Works
description: The settings for a self-hosted Ever Works, with the optional connection to your Ever account.
slug: works
order: 0
snippets: [compose, env]
sources:
  - repo: ever-works/ever-works
    path: README.md#with-docker-compose
    sha: "89364209683a04768be233b5f1aaaf5b19f8c050"
  - repo: ever-works/ever-works
    path: docker-compose.yml
    sha: "89364209683a04768be233b5f1aaaf5b19f8c050"
verified: 2026-10-01
---

You need a Linux server with Docker Compose v2.20 or later. The full stack uses PostgreSQL and
Redis, both included in the Compose files.

1. Install Ever Works with Docker Compose as the
   [README](https://github.com/ever-works/ever-works#with-docker-compose) describes; for
   Kubernetes, follow the deployment guides at [docs.ever.works](https://docs.ever.works).
2. Put the settings below into the environment of the API (the `ever-works-api` service of the
   Compose file, or `.env.compose`) before its first start.
