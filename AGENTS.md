# Working in this repository (for coding agents and people alike)

This repository is public. Everything in it (files, commit messages, pull request titles and
bodies, issue text) is public.

## What the repository is

- `apps/web`: the ever.sh site, SolidStart 2 + Solid 1.9 + Tailwind 4. Content is Markdown in
  `content/`, compiled at build time by `apps/web/tools/build-content.mjs`. Every page except
  `/hosting` is runtime-free (`apps/web/runtime-free.mjs`).
- `crates/api`, `crates/core`: the Rust API service (axum) the site reads hosting options from, and
  the rules shared with the site (products, hosting targets, connect codes, link rendering).
- `tools/`: repository checks. Each one has `--self-test`, and CI runs all of them.

## Rules

1. The site and its API service read only public, unauthenticated endpoints of the Ever Platform.
   No credential, cookie, session or write; no internal host, address or secret path in any file
   (`tools/check-no-internals.mjs`).
2. Public wording only: describe features in plain words; no prices in content
   (`tools/check-public-copy.mjs`).
3. `EVER_SH_URL` is the only source of the site's own origin (`tools/check-canonical-origin.mjs`).
4. A connect code from a URL is used only when it matches its exact grammar, and is never logged,
   stored or echoed otherwise. This site never creates one.
5. Hosting options come from the hosting list (`content/hosting/hosts.yaml`, refreshed with
   `just refresh-targets`), never from code. Links that carry Ever's referral code are marked
   `rel="sponsored noopener"` with the note "We may earn a referral fee" next to them.
6. Dependencies: permissive licences only (`deny.toml`, the `licences` CI job), crates.io and the
   npm registry only, no git dependencies.
7. Do not add, edit or remove licence files, licence headers or `license` fields.
8. Before you push: `just preflight` (or `sh tools/preflight.sh`) must pass.

Commit messages are short and plain (`feat: hosting chooser`, `fix: install page title`).
