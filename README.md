# ever.sh

The source of [ever.sh](https://ever.sh): guides for running Ever products on your own
infrastructure, a comparison of hosting options, and install pages with ready-to-paste settings.

Products covered: Ever Gauzy, Ever Teams, Ever Works, Ever Rec, Ever Traduora (and Ever Demand,
coming soon).

## How the site works

- **Content is Markdown** in [`content/`](content/). Each product has its own folder; pages are
  compiled to HTML when the site is built. Fixing a guide is a pull request to a Markdown file.
  The build refuses a page without its front matter, a guide that does not cite the product
  documents it condenses, and a link to a page that does not exist.
- **The hosting chooser** (`/hosting`) reads the list of hosting options from this repository's
  small Rust API service ([`crates/api`](crates/api)). The service answers from the committed list
  [`content/hosting/hosts.yaml`](content/hosting/hosts.yaml), compiled into it, and will read the
  live list from the Ever Platform API (`GET https://api.ever.co/v1/hosting-targets`) with that
  file as its fallback. When the service cannot be reached, the site uses its own built-in copy of
  the same file. A saved list is labelled with its date. The site never hard-codes a host. Links
  that carry Ever's referral code at a host are marked, with "We may earn a referral fee" next to
  them.
- **Install pages** (`/install/<product>`) give you the environment settings for your install.
  They record that the install was set up from ever.sh (`EVER_INSTALL_SOURCE=ever.sh`), keep
  anonymous usage statistics on with the one-line way to turn them off, and connect the install to
  your Ever organization **only** if you ask for it. Connect codes are created in your Ever
  account, never on this site.
- The site reads only public, unauthenticated endpoints. It has no accounts, no cookies and no
  forms, and every page except the hosting chooser is plain HTML and CSS, without JavaScript.

## Develop

Requirements: Node 24, pnpm 10.34.5 (`corepack enable`), Rust (the toolchain pinned in
`rust-toolchain.toml` installs itself through rustup), `just` (optional), Docker for the images.

```sh
pnpm install
just api            # the API service on http://localhost:8080
just dev            # the site on http://localhost:3000 (reads the API through EVER_SH_API_URL)
just preflight      # the checks CI runs
just image          # build both images and run them together
```

| Path | What it is |
|---|---|
| `apps/web` | the SolidStart site; `serve.mjs` is the production server |
| `crates/api`, `crates/core` | the Rust API service the site reads hosting options from, and the rules it shares with the site |
| `content/products/<product>/*.md` | product guides |
| `content/install/<product>.md` | the text of each install page |
| `content/platform/*.md` | Ever Connect, anonymous usage statistics, free and paid |
| `content/hosting/` | chooser text, the hosting list and its schema |
| `tools/` | repository checks, each with a self-test |
| `deploy/docker/web/Dockerfile`, `deploy/docker/api/Dockerfile` | the two production images |

### Configuration

| Variable | Read by | Default | Meaning |
|---|---|---|---|
| `EVER_SH_URL` | web | `http://127.0.0.1:3000` | the public origin of the deployment; canonical links, the sitemap and the connect flow's return address are built from it |
| `EVER_SH_API_URL` | web | `http://127.0.0.1:8080` | this repository's API service |
| `EVER_APP_URL` | web | `https://app.ever.co` | the Ever account portal, where connect codes are created |
| `EVER_SH_INDEXABLE` | web | `false` | `true` lets search engines index the deployment |
| `EVER_API_URL` | api | `https://api.ever.co` | the public Ever Platform API |
| `HOST`, `PORT` | web, api | `0.0.0.0`; web `3000`, api `8080` | bind address |

A malformed value stops the process at start-up instead of serving with a guess.

## Contributing

Pull requests are welcome, especially corrections to the guides. Keep pages factual, cite the
product documents a page condenses in its front matter, and link to the product's own
documentation for depth. CI must be green. Please report security issues as described in
[SECURITY.md](SECURITY.md).

## License

See [LICENSE](LICENSE).
