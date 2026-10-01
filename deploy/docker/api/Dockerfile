# syntax=docker/dockerfile:1
# =============================================================================
#  ever.sh API service: ghcr.io/ever-co/web-ever-sh-api
#
#    docker build -f deploy/docker/api/Dockerfile -t web-ever-sh-api .
#    docker run -p 8080:8080 web-ever-sh-api
#
#  Build from the repository ROOT: the hosting snapshot (content/hosting/hosts.yaml) is compiled
#  into the binary. At runtime it reads HOST, PORT (8080) and EVER_API_URL; a malformed value
#  stops it at start-up (exit 78). GET /healthz answers without any other work.
# =============================================================================

ARG RUST_IMAGE=lukemathwalker/cargo-chef:0.1.78-rust-1.98.1-slim-trixie
ARG RUNTIME_IMAGE=debian:trixie-slim

# ── toolchain ────────────────────────────────────────────────────────────────
FROM ${RUST_IMAGE} AS chef
WORKDIR /build
# rust-toolchain.toml pins the 1.98 channel; inside the image the toolchain the image carries
# (RUST_VERSION, a 1.98 release) is used instead of rustup downloading a second one.
ENV RUSTUP_TOOLCHAIN=${RUST_VERSION} \
    CARGO_TERM_COLOR=always \
    CARGO_NET_RETRY=10

# ── planner: the dependency recipe ───────────────────────────────────────────
FROM chef AS planner
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates crates
RUN cargo chef prepare --recipe-path recipe.json

# ── builder ──────────────────────────────────────────────────────────────────
FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
# Dependencies only: reused until Cargo.lock or a manifest changes. `--locked` as in CI.
RUN cargo chef cook --release --locked --recipe-path recipe.json --package ever-sh-api
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates crates
COPY content/hosting content/hosting
RUN cargo build --release --locked -p ever-sh-api \
    && install -m 0755 target/release/ever-sh-api /ever-sh-api

# ── runtime ──────────────────────────────────────────────────────────────────
# trixie-slim rather than distroless: operators get a shell for `kubectl exec`. No CA bundle yet:
# the service makes no outbound call while it answers from the snapshot.
FROM ${RUNTIME_IMAGE} AS runtime
RUN groupadd --system --gid 10001 ever \
    && useradd --system --uid 10001 --gid ever --no-create-home --shell /usr/sbin/nologin ever
COPY --from=builder /ever-sh-api /usr/local/bin/ever-sh-api
LABEL org.opencontainers.image.source="https://github.com/ever-co/sh" \
      org.opencontainers.image.title="web-ever-sh-api" \
      org.opencontainers.image.description="ever.sh API service"
USER 10001:10001
ENV HOST=0.0.0.0 \
    PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["/usr/local/bin/ever-sh-api", "probe", "/healthz"]
ENTRYPOINT ["/usr/local/bin/ever-sh-api"]
