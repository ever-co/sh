#!/bin/sh
# Everything CI runs, locally: the web, the Rust service, the repository checks.
#   sh tools/preflight.sh          (or `just preflight`)
set -eu
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$*"; }

step "web: install, Biome, content, types, tests, build"
pnpm install --frozen-lockfile
pnpm exec biome ci .
pnpm --filter @ever-sh/web run content
pnpm turbo run typecheck test build

step "rust: formatting, Clippy, tests, dependency policy"
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
if command -v cargo-deny >/dev/null 2>&1; then
  cargo deny check
else
  echo "cargo-deny is not installed: skipped here (CI runs it; cargo install cargo-deny --locked)"
fi

step "repository checks"
sh tools/guards.sh
pnpm run licences

printf '\npreflight: all green\n'
