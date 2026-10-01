#!/usr/bin/env node
/**
 * check-image-modules: the web image boots.
 *
 * `apps/web/serve.mjs` runs without a build step, so every local module it imports (and every
 * local module those import, transitively) must be copied into the runtime image by
 * `deploy/docker/web/Dockerfile`; a missing one is an image that builds green and dies at boot.
 * The build output (`./dist/...`) is copied as a directory and must be copied too.
 *
 *   node tools/check-image-modules.mjs
 *   node tools/check-image-modules.mjs --self-test
 */
import { readFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WEB = join(REPO, "apps", "web");
const DOCKERFILE = join(REPO, "deploy", "docker", "web", "Dockerfile");
const IMPORT =
  /(?:^|[\s;])(?:import|export)\s[^"'`]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

/** The relative specifiers a module imports. */
export function localImports(source) {
  return [...source.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);
}

/** The files the Dockerfile copies from the web app into the runtime stage. */
export function copiedFiles(dockerfile) {
  const copied = new Set();
  for (const line of dockerfile.split("\n")) {
    if (!/^\s*COPY\s+--from=/.test(line)) continue;
    for (const token of line.trim().split(/\s+/).slice(2, -1)) {
      const m = /apps\/web\/(.+)$/.exec(token);
      if (m) copied.add(m[1].replace(/\/$/, ""));
    }
  }
  return copied;
}

/** Local modules reachable from `entry` (paths relative to the web app), `dist/` excluded. */
export async function reachable(entry, read = (p) => readFile(join(WEB, p), "utf8")) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of localImports(await read(file))) {
      const target = posix.normalize(posix.join(posix.dirname(file), spec));
      if (target.startsWith("dist/")) continue;
      queue.push(target);
    }
  }
  return [...seen];
}

/** What is imported but not copied. */
export function missing(modules, copied, usesDist) {
  const out = modules.filter((m) => !copied.has(m));
  if (usesDist && !copied.has("dist")) out.push("dist");
  return out;
}

async function selfTest() {
  const sources = {
    "serve.mjs":
      'import { a } from "./a.mjs";\nconst { default: app } = await import("./dist/server/entry-server.js");',
    "a.mjs": 'export { b } from "./lib/b.mjs";',
    "lib/b.mjs": "export const b = 1;",
  };
  const modules = await reachable("serve.mjs", async (p) => sources[p] ?? "");
  const dockerfile =
    "COPY --from=builder /repo/apps/web/dist ./dist\nCOPY --from=builder /repo/apps/web/serve.mjs /repo/apps/web/a.mjs ./\n";
  const gaps = missing(modules, copiedFiles(dockerfile), true);
  if (gaps.length !== 1 || gaps[0] !== "lib/b.mjs") {
    process.stderr.write(
      `check-image-modules self-test FAILED: expected [lib/b.mjs], got ${JSON.stringify(gaps)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check-image-modules self-test: ok\n");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const serve = await readFile(join(WEB, "serve.mjs"), "utf8");
  const modules = await reachable("serve.mjs");
  const gaps = missing(
    modules,
    copiedFiles(await readFile(DOCKERFILE, "utf8")),
    serve.includes("./dist/"),
  );
  if (gaps.length > 0) {
    process.stderr.write(
      `check-image-modules: deploy/docker/web/Dockerfile does not copy: ${gaps.join(", ")} (imported by ${posix.join("apps/web", dirname("serve.mjs"))}/serve.mjs)\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`check-image-modules: ok (${modules.join(", ")} + dist)\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
