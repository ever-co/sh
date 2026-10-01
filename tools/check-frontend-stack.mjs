#!/usr/bin/env node
/**
 * check-frontend-stack: the site is SolidJS. A package of this workspace that depends on another
 * UI framework (React, Next.js, Vue, Svelte, Angular, Preact) fails, and the web app must depend
 * on solid-js.
 *
 *   node tools/check-frontend-stack.mjs
 *   node tools/check-frontend-stack.mjs --self-test
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FOREIGN = new Set([
  "react",
  "react-dom",
  "next",
  "vue",
  "nuxt",
  "svelte",
  "@sveltejs/kit",
  "@angular/core",
  "preact",
]);
const FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Findings in one package manifest. */
export function findings(manifest, file) {
  const out = [];
  for (const field of FIELDS) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (FOREIGN.has(name)) out.push(`${file}: ${field} has ${name}`);
    }
  }
  return out;
}

async function manifests() {
  const files = ["package.json"];
  for (const dir of ["apps", "packages"]) {
    for (const e of await readdir(join(REPO, dir), { withFileTypes: true }).catch(() => [])) {
      if (e.isDirectory()) files.push(`${dir}/${e.name}/package.json`);
    }
  }
  const out = [];
  for (const file of files) {
    const text = await readFile(join(REPO, file), "utf8").catch(() => null);
    if (text !== null) out.push({ file, manifest: JSON.parse(text) });
  }
  return out;
}

function selfTest() {
  const bad = findings(
    { dependencies: { react: "19.0.0" }, devDependencies: { next: "16.0.0" } },
    "x/package.json",
  );
  const good = findings({ dependencies: { "solid-js": "1.9.15" } }, "y/package.json");
  if (bad.length !== 2 || good.length !== 0) {
    process.stderr.write("check-frontend-stack self-test FAILED\n");
    process.exit(1);
  }
  process.stdout.write("check-frontend-stack self-test: ok\n");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const all = await manifests();
  const found = all.flatMap(({ file, manifest }) => findings(manifest, file));
  const web = all.find((m) => m.file === "apps/web/package.json");
  if (!web?.manifest.dependencies?.["solid-js"])
    found.push("apps/web/package.json: solid-js is not a dependency");
  if (found.length > 0) {
    process.stderr.write(
      `check-frontend-stack: ${found.length} finding(s)\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`check-frontend-stack: ok (${all.length} manifests)\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
