# syntax=docker/dockerfile:1
# =============================================================================
#  ever.sh web site: ghcr.io/ever-co/web-ever-sh
#
#    docker build -f deploy/docker/web/Dockerfile -t web-ever-sh .
#    docker run -p 3000:3000 -e EVER_SH_URL=http://127.0.0.1:3000 web-ever-sh
#
#  Build from the repository ROOT (pnpm workspace; content/ is compiled into the image at build
#  time). At runtime the container reads EVER_SH_URL (its public origin), EVER_SH_API_URL (this
#  repository's API service, deploy/docker/api/Dockerfile; default http://127.0.0.1:8080),
#  EVER_APP_URL (the Ever account portal) and EVER_SH_INDEXABLE; a malformed value stops it at
#  start-up. GET /healthz answers without calling anything.
# =============================================================================

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
# pnpm is pinned by `packageManager` in the root package.json; naming it here too means the image
# cannot build with another pnpm than the one that wrote the lockfile.
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
# The web app and what it depends on, frozen: an install that would change the lockfile fails.
RUN pnpm install --frozen-lockfile --filter "@ever-sh/web..."
COPY apps apps
COPY content content
# Compiles content/ (Markdown, the hosting list) and runs vite build.
RUN pnpm --filter @ever-sh/web build
# The production dependency tree (solid-js; everything else is bundled) as a plain node_modules.
RUN pnpm --filter @ever-sh/web deploy --prod --legacy /out

# ── runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
# tini: Node as PID 1 would not get the SIGTERM a pod deletion sends; under tini serve.mjs does.
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /repo/apps/web/dist ./dist
# serve.mjs and every local module it imports (tools/check-image-modules.mjs holds this list).
COPY --from=builder /repo/apps/web/serve.mjs /repo/apps/web/site-origin.mjs /repo/apps/web/http-policy.mjs /repo/apps/web/runtime-free.mjs /repo/apps/web/package.json ./
LABEL org.opencontainers.image.source="https://github.com/ever-co/sh" \
      org.opencontainers.image.title="web-ever-sh" \
      org.opencontainers.image.description="ever.sh web site"
# Nothing writes to disk: files stay root-owned, the process runs unprivileged.
USER node
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "serve.mjs"]
