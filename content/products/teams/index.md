---
title: Self-host Ever Teams
description: Run Ever Teams on your own infrastructure.
slug: index
order: 0
sources:
  - repo: ever-co/ever-teams
    path: README.md
    sha: "e6ebffadbd807fcc2178a70d7ff3e41e2f90cf22"
verified: 2026-10-01
---

Ever Teams is a work and project management app. It uses the Ever Gauzy API as its backend, so a
self-hosted Teams runs the Teams web app together with a Gauzy API (the Compose files of the
repository start both).

- [Install settings](/install/teams): the environment block for your install.
- [Other options](/hosting?product=teams): Kubernetes, Ever Cloud and one-click hosts.

The [README](https://github.com/ever-co/ever-teams#run-with-docker-compose) covers Docker Compose,
a single container against an existing Gauzy API, and runtime configuration.
