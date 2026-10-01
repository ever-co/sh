#!/usr/bin/env node
/**
 * check-canonical-origin: `EVER_SH_URL` is the only source of this site's own origin.
 *
 * Canonical links, the sitemap, robots.txt and the `return_to` of the connect flow are built from
 * `SITE_ORIGIN` (apps/web/site-origin.mjs). A literal ever.sh origin (the production host or its
 * dev and stage hosts) anywhere else in the site's code would point a dev or stage deployment at
 * production, so it fails the build, unless its line carries the marker `canonical-origin: allow`
 * (for code that recognises such a URL in data instead of emitting one).
 *
 *   node tools/check-canonical-origin.mjs
 *   node tools/check-canonical-origin.mjs --self-test
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WEB = join(REPO, "apps", "web");
const ORIGIN_FILE = "apps/web/site-origin.mjs";
/** `https://ever.sh`, `https://dev.ever.sh`, also as written inside a regex (`https:\/\/ever\.sh`). */
const LITERAL = /https?:(?:\/\/|\\\/\\\/)(?:(?:dev|stage)\\?\.)?ever\\?\.sh(?![\w.-])/i;
const MARKER = "canonical-origin: allow";
const CODE = /\.(m?[jt]sx?)$/;

/** Findings in one source text. */
export function findings(text, file) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (LITERAL.test(line) && !line.includes(MARKER))
      out.push(`${file}:${i + 1}: a literal site origin`);
  });
  return out;
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      if (
        !["node_modules", "dist", ".output", ".turbo", "content.generated", "fixtures"].includes(
          e.name,
        )
      ) {
        yield* walk(path);
      }
    } else if (CODE.test(e.name) && !/\.test\.[mc]?[jt]sx?$/.test(e.name)) {
      yield path;
    }
  }
}

function selfTest() {
  const bad = [
    'const canonical = "https://ever.sh/gauzy";',
    "const u = `https://stage.ever.sh${path}`;",
    "const re = /^https:\\/\\/dev\\.ever\\.sh(\\/.*)$/;",
  ];
  const good = [
    "const re = /^https:\\/\\/(dev\\.)?ever\\.sh/; // canonical-origin: allow",
    "const site = `${SITE_ORIGIN}/gauzy`;",
    'const other = "https://ever.co"; const shared = "https://ever.shop.example";',
  ];
  const missed = bad.filter((line) => findings(line, "x.ts").length === 0);
  const falsePositives = good.flatMap((line) => findings(line, "x.ts"));
  if (missed.length > 0 || falsePositives.length > 0) {
    process.stderr.write(
      `check-canonical-origin self-test FAILED: ${missed.length} missed, ${falsePositives.length} false positive(s)\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check-canonical-origin self-test: ok\n");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const found = [];
  for await (const file of walk(WEB)) {
    const rel = relative(REPO, file).split(sep).join("/");
    if (rel === ORIGIN_FILE) continue;
    found.push(...findings(await readFile(file, "utf8"), rel));
  }
  const origin = await readFile(join(REPO, ORIGIN_FILE), "utf8");
  if (!origin.includes("EVER_SH_URL")) found.push(`${ORIGIN_FILE}: does not read EVER_SH_URL`);
  if (found.length > 0) {
    process.stderr.write(
      `check-canonical-origin: ${found.length} finding(s)\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check-canonical-origin: ok\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
