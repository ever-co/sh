# ever.sh task runner. `just` lists the recipes.
default:
    @just --list

# Everything CI runs, locally (the same script CI's jobs are made of).
preflight:
    sh tools/preflight.sh

# The site on :3000 (content is compiled first). Run `just api` beside it for the hosting list.
dev:
    pnpm --filter @ever-sh/web run dev

# The API service on :8080 (the site reads it through EVER_SH_API_URL=http://127.0.0.1:8080).
api:
    cargo run -p ever-sh-api

# Recompile content/ only (Markdown and the hosting list).
content:
    pnpm --filter @ever-sh/web run content

# Every repository check, each with its self-test.
guards:
    sh tools/guards.sh

# Refresh the hosting list from the public Ever Platform API (review the diff before committing).
refresh-targets api="https://api.ever.co":
    node tools/refresh-targets.mjs --api {{api}} --out content/hosting/hosts.yaml

# Vendor the published statistics schema (CI then compares it with the published one).
vendor-stats-schema api="https://api.ever.co":
    mkdir -p content/stats
    curl -fsS {{api}}/v1/stats/schema -o content/stats/ever.stats.v1.schema.json

# Build both production images and run them together: the site on :3000 reads the API service.
# Stop with `docker rm -f ever-sh-web ever-sh-api`.
image:
    docker build -f deploy/docker/api/Dockerfile -t web-ever-sh-api:local .
    docker build -f deploy/docker/web/Dockerfile -t web-ever-sh:local .
    docker network create ever-sh-local >/dev/null 2>&1 || true
    docker run -d --rm --name ever-sh-api --network ever-sh-local web-ever-sh-api:local
    docker run -d --rm --name ever-sh-web --network ever-sh-local -p 3000:3000 -e EVER_SH_URL=http://127.0.0.1:3000 -e EVER_SH_API_URL=http://ever-sh-api:8080 web-ever-sh:local
