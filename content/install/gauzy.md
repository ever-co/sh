---
title: Install Ever Gauzy
description: The settings for a self-hosted Ever Gauzy, with the optional connection to your Ever account.
slug: gauzy
order: 0
snippets: [compose, env, helm]
sources:
  - repo: ever-co/ever-gauzy
    path: README.md#run-with-docker-compose
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
  - repo: ever-co/ever-charts
    path: charts/ever-gauzy/README.md
    sha: "10ade00bb2a797864ac0449ca47fee3ca9cdfdb7"
verified: 2026-10-01
---

You need a 64-bit Linux server with Docker Compose v2.20 or later, or a Kubernetes cluster. See the
[requirements](/gauzy/requirements).

1. Install Ever Gauzy with the [Docker Compose guide](/gauzy/docker), or on Kubernetes with the
   Helm chart:

   ```bash
   helm repo add ever-co https://charts.ever.co
   helm install gauzy ever-co/ever-gauzy -f values.yaml
   ```

2. Put the settings below into the API's environment before its first start: the `api` service
   of the Compose file, your environment file, or the chart values (`values.yaml`).

Every other setting is documented at [docs.gauzy.co](https://docs.gauzy.co).
