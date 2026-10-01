---
title: Install Ever Traduora
description: The settings for a self-hosted Ever Traduora, with the optional connection to your Ever account.
slug: traduora
order: 0
snippets: [compose, env]
sources:
  - repo: ever-co/ever-traduora
    path: docs/deployment.md
    sha: "f29a2167284c6df2c30c5066bf166f7268cb0af5"
  - repo: ever-co/ever-traduora
    path: docker-compose.yaml
    sha: "f29a2167284c6df2c30c5066bf166f7268cb0af5"
verified: 2026-10-01
---

Ever Traduora runs as one container with a database (MySQL 5.7 or later; other databases through
`TR_DB_TYPE`). Serve it only behind a reverse proxy that terminates TLS.

1. Install it as the [deployment guide](https://docs.traduora.co/docs/deployment) describes, with
   Docker Compose, a single container or Kubernetes.
2. Put the settings below into the container's environment (the `traduora` service of the Compose
   file) before its first start.

Every setting is listed in the [configuration guide](https://docs.traduora.co/docs/configuration).
