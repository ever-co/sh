---
title: Install Ever Teams
description: The settings for a self-hosted Ever Teams, with the optional connection to your Ever account.
slug: teams
order: 0
snippets: [compose, env, helm]
sources:
  - repo: ever-co/ever-teams
    path: README.md#run-with-docker-compose
    sha: "e6ebffadbd807fcc2178a70d7ff3e41e2f90cf22"
  - repo: ever-co/ever-charts
    path: charts/ever-teams-stack/README.md
    sha: "10ade00bb2a797864ac0449ca47fee3ca9cdfdb7"
verified: 2026-10-01
---

Ever Teams runs as the Teams web app plus an Ever Gauzy API. The repository's Compose files start
both; on Kubernetes the `ever-co/ever-teams-stack` chart installs both.

1. Install it with Docker Compose as the
   [README](https://github.com/ever-co/ever-teams#run-with-docker-compose) describes, or with Helm:

   ```bash
   helm repo add ever-co https://charts.ever.co
   helm install teams ever-co/ever-teams-stack -f values.yaml
   ```

2. Put the settings below into the environment of the Gauzy API (the `api` service of the Compose
   file, or the chart values): the API reports for the pair.

To use an API you already run, point `GAUZY_API_SERVER_URL` and `NEXT_PUBLIC_GAUZY_API_SERVER_URL`
at it; see the [README](https://github.com/ever-co/ever-teams#run-with-a-self-hosted-backend).
