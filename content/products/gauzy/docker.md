---
title: Ever Gauzy with Docker Compose
description: Run Ever Gauzy on one server with Docker Compose and the published images.
slug: docker
order: 10
sources:
  - repo: ever-co/ever-gauzy
    path: README.md#run-with-docker-compose
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
  - repo: ever-co/ever-gauzy
    path: docker-compose.yml
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
  - repo: ever-co/ever-gauzy
    path: docker-compose.demo.yml
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
  - repo: ever-co/ever-gauzy
    path: docker-compose.infra.yml
    sha: "367a01a66da637257313b0321fb60d10bc5ea1ef"
verified: 2026-10-01
---

The repository [ever-co/ever-gauzy](https://github.com/ever-co/ever-gauzy) ships the Compose files.
You need Docker Compose v2.20 or later.

| File | Use |
|---|---|
| `docker-compose.demo.yml` | the smallest setup (API, web app, database) for a first look |
| `docker-compose.yml` | production-shaped setup with prebuilt images and the infrastructure services |
| `docker-compose.infra.yml` | the infrastructure services only |

## Try it

```bash
git clone https://github.com/ever-co/ever-gauzy.git
cd ever-gauzy
docker compose -f docker-compose.demo.yml up
```

The web app opens on port 4200. The demo accounts exist only in this demo setup.

## Run it for real

Before the first start, edit `.env.compose`:

- set `JWT_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `JWT_VERIFICATION_TOKEN_SECRET` and
  `EXPRESS_SESSION_SECRET` to strong, unique values (for example `openssl rand -hex 64`); the API
  refuses to start with the shipped defaults;
- set `DEMO_SUPER_ADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD` and `DEMO_EMPLOYEE_PASSWORD`, which the
  first start uses for the initial accounts.

```bash
docker compose up -d
```

The first start seeds the database and takes a while. For production workloads the Gauzy team
recommends Kubernetes; see the [README](https://github.com/ever-co/ever-gauzy#run-with-docker-compose)
for every option.

## Settings from ever.sh

Add the lines from the [install page](/install/gauzy) to your environment. They record that this
install was set up from ever.sh, keep anonymous usage statistics on (one line turns them off) and,
only if you asked for it, connect the install to your Ever organization.
