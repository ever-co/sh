#!/usr/bin/env node
/**
 * check-no-internals: this repository is public, and the site and its API service talk only to
 * public endpoints. Fails when a tracked text file contains:
 *
 *   - an in-cluster service host (`<name>.<namespace>.svc`, `*.svc.cluster.local`);
 *   - a secret-store path (`kv/<mount>/<path>`);
 *   - a private API surface (`/v1/admin`, `/v1/my`, `/v1/me`) or a session header;
 *   - a payment-provider key or key name;
 *   - a private network address (10/8, 172.16/12, 192.168/16, 169.254/16) or a LAN host name
 *     (`*.local`, `*.lan`, `*.internal`, `*.home.arpa`);
 *   - an environment host of the Ever Platform (dev and stage API or portal hosts; those belong in
 *     deployment configuration, never in this repository);
 *   - a planning reference (decision, work-package or section ids) or a review marker;
 *   - an `http://` or `https://` host that is not on the allow-list below.
 *
 * A finding prints the file, the line and the rule, never the matched text: CI logs of a public
 * repository are public too. A line containing `check-no-internals: allow` is skipped.
 *
 *   node tools/check-no-internals.mjs               scan the repository
 *   node tools/check-no-internals.mjs --root <dir>  scan every file under <dir> (fixtures)
 *   node tools/check-no-internals.mjs --self-test   plant one violation per rule; exit 1 unless
 *                                                   every one is caught (a check that cannot fail
 *                                                   is not a check)
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCAN_DIRS = ["apps", "crates", "content", "tools", "deploy", ".github"];
const ROOT_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SECURITY.md",
  "CODEOWNERS",
  "justfile",
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "biome.json",
  "tsconfig.base.json",
  "Cargo.toml",
  "deny.toml",
  "rust-toolchain.toml",
  "rustfmt.toml",
  "clippy.toml",
  ".editorconfig",
  ".gitignore",
  ".gitattributes",
  ".dockerignore",
];
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".output",
  ".turbo",
  "target",
  "content.generated",
  "fixtures",
]);
/** Files that must name the patterns they look for. */
const SELF = new Set(["tools/check-no-internals.mjs", "tools/check-no-internals.test.mjs"]);
const TEXT =
  /\.(m?[jt]sx?|json|ya?ml|md|css|html|txt|sh|rs|toml|svg)$|(^|[\\/])(Dockerfile|justfile|CODEOWNERS)$/;

/** Hosts a file here may name: Ever's public sites, product sites, tooling, the listed hosts. */
const ALLOWED_HOSTS = [
  /^(dev\.|stage\.)?ever\.sh$/,
  /^(api|app|apps|charts)\.ever\.co$/,
  /^ever\.co$/,
  /^docs\.[a-z0-9.-]+$/,
  /^(gauzy\.co|ever\.team|ever\.works|rec\.so|traduora\.co|everdemand\.co)$/,
  /^github\.com$/,
  /^ghcr\.io$/,
  /^json-schema\.org$/,
  /^biomejs\.dev$/,
  /^turborepo\.com$/,
  /^sh\.rustup\.rs$/,
  /^www\.sitemaps\.org$/,
  /^www\.w3\.org$/,
  // third-party hosts listed in content/hosting/hosts.yaml (reviewed data); www.hostg.xyz is the
  // Hostinger referral redirect the Ever Gauzy README uses
  /^(www\.)?hostinger\.com$/,
  /^www\.hostg\.xyz$/,
  /^railway\.(app|com)$/,
  /^render\.com$/,
  /^easypanel\.io$/,
  /^repocloud\.io$/,
  /^elest\.io$/,
  /^app\.netlify\.com$/,
  /^app\.koyeb\.com$/,
  /^app\.northflank\.com$/,
  /^heroku\.com$/,
  // brand-kit pages cited as the sources of logos in apps/web/public/logos/README.md
  /^www\.docker\.com$/,
  /^devcenter\.heroku\.com$/,
  /^northflank\.com$/,
  // loopback, the containers `just image` starts on a local Docker network, and the names
  // reserved for examples and tests (RFC 2606, RFC 6761)
  /^(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])$/,
  /^ever-sh-(api|web)$/,
  /^([a-z0-9-]+\.)*(example|invalid)$/,
  /^(www\.)?example\.(com|net|org)$/,
];

const RULES = [
  {
    name: "in-cluster service host",
    re: /(?<![.\w-])[a-z0-9-]+(\.[a-z0-9-]+)*\.svc(\.cluster\.local)?(?![-.\w])/,
  },
  { name: "secret-store path", re: /\bkv\/[a-z0-9_-]+\/[a-z0-9_-]+/i },
  { name: "private API surface", re: /\/v1\/(admin|my|me)\b/ },
  { name: "session header", re: /\bx-ever-session\b/i },
  { name: "payment key", re: /\bSTRIPE_[A-Z_]+|\b(sk|rk|pk)_(live|test)_|\bwhsec_/ },
  {
    name: "private network address",
    re: /\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01])|169\.254)\.\d{1,3}\.\d{1,3}\b/,
  },
  {
    name: "LAN host name",
    re: /(?<![.\w-])[a-z0-9-]+(\.[a-z0-9-]+)*\.(local|lan|internal|home\.arpa)(?![-.\w])/,
  },
  { name: "environment host", re: /\b(api|app|apps|auth)-(dev|stage)\.ever\.co\b/i },
  {
    name: "planning reference",
    re: /\b(D-\d{1,3}|[PE]\d-\d{1,3}|WP-\d+(\.\d+)?|AT-P\d-\d+|RG-[A-Z]{2,}|N-\d{1,3}|[SL]-\d)\b|§/,
  },
  { name: "review marker", re: /PUBLIC-SAFE DRAFT|INTERNAL: contains/ },
];

/** The host of every http(s) URL in a line (user information skipped). */
const URL_HOST = /\bhttps?:\/\/(?:[^\s/@]+@)?(\[[0-9a-f:]+\]|[a-z0-9.-]+)/gi;

/** Findings in one text, as `file:line: rule` strings. */
export function violations(text, file = "<memory>") {
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (line.includes("check-no-internals: allow")) return;
    for (const rule of RULES) if (rule.re.test(line)) out.push(`${file}:${i + 1}: ${rule.name}`);
    for (const m of line.matchAll(URL_HOST)) {
      const host = m[1].toLowerCase().replace(/\.$/, "");
      if (!ALLOWED_HOSTS.some((h) => h.test(host)))
        out.push(`${file}:${i + 1}: host not on the allow-list`);
    }
  });
  return out;
}

async function* walk(dir, base) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(path, base);
    } else if (TEXT.test(e.name) || e.name.startsWith(".")) {
      yield path;
    }
  }
}

/** Every finding under `root`; the repository layout unless `fixture` scans everything. */
export async function scan(root, { fixture = false } = {}) {
  const files = [];
  if (fixture) {
    for await (const f of walk(root)) files.push(f);
  } else {
    for (const dir of SCAN_DIRS) for await (const f of walk(join(root, dir))) files.push(f);
    for (const f of ROOT_FILES) files.push(join(root, f));
  }
  const found = [];
  for (const file of files) {
    const rel = relative(root, file).split(sep).join("/");
    if (!fixture && SELF.has(rel)) continue;
    const text = await readFile(file, "utf8").catch(() => null);
    if (text !== null) found.push(...violations(text, rel));
  }
  return found;
}

/** One planted line per rule, and lines that must stay clean. */
export const PLANTED = [
  "fetch('http://orders-api.shop-prod.svc.cluster.local:8080')",
  "read kv/shop/prod",
  "GET /v1/admin/stats",
  "headers['x-ever-session'] = token",
  "STRIPE_SECRET_KEY=",
  "CACHE=10.20.30.40:6380",
  "see http://build-box.lan:8080",
  "EVER_API_URL=https://api-stage.ever.co",
  "as decided in D-999",
  "<!-- PUBLIC-SAFE DRAFT -->",
  "see https://internal-wiki.example.net/page",
];
export const CLEAN = [
  "https://api.ever.co/v1/hosting-targets and https://docs.gauzy.co and http://127.0.0.1:3000/healthz",
  "GET /v1/meta answers; icons are .svg files; Docker 29 and Node 24; the 10th time",
  "https://www.hostg.xyz/aff_c?offer_id=815&aff_id=244060&url_id=6822 and http://ever-smoke-api.invalid:9",
  "cp .env.local .env; https://user:secret@api.ever.co is refused; svc_name.svcx is not a host",
];

function selfTest() {
  const missed = PLANTED.filter((line) => violations(line).length === 0);
  const falsePositives = CLEAN.flatMap((line) => violations(line));
  if (missed.length > 0 || falsePositives.length > 0) {
    process.stderr.write(
      `check-no-internals self-test FAILED: ${missed.length} planted line(s) not caught, ${falsePositives.length} false positive(s)\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `check-no-internals self-test: ok (${PLANTED.length} planted, all caught)\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  const i = args.indexOf("--root");
  const root = i >= 0 ? resolve(args[i + 1] ?? ".") : REPO;
  const found = await scan(root, { fixture: i >= 0 });
  if (found.length > 0) {
    process.stderr.write(
      `check-no-internals: ${found.length} finding(s)\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check-no-internals: ok\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
