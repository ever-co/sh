#!/usr/bin/env node
/**
 * check-npm-licences: every package in the production npm dependency tree (what the web image
 * ships) carries a permissive licence. Reads `pnpm licenses list --prod --json` (run after
 * `pnpm install`); an SPDX `OR` expression passes when one choice is allowed, an `AND` expression
 * when every part is.
 *
 *   node tools/check-npm-licences.mjs
 *   node tools/check-npm-licences.mjs --self-test
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "BlueOak-1.0.0",
]);

/** True when an SPDX expression is acceptable. */
export function allowed(expression) {
  const e = String(expression)
    .trim()
    .replace(/^\((.*)\)$/, "$1");
  if (/\s+OR\s+/i.test(e)) return e.split(/\s+OR\s+/i).some(allowed);
  if (/\s+AND\s+/i.test(e)) return e.split(/\s+AND\s+/i).every(allowed);
  return ALLOWED.has(e);
}

/** `name@version: licence` for every package whose licence is not acceptable. */
export function findings(report) {
  const out = [];
  for (const [licence, packages] of Object.entries(report)) {
    if (allowed(licence)) continue;
    for (const p of packages) out.push(`${p.name}@${(p.versions ?? []).join(",")}: ${licence}`);
  }
  return out.sort();
}

function selfTest() {
  const report = {
    MIT: [{ name: "a", versions: ["1.0.0"] }],
    "(MIT OR GPL-3.0)": [{ name: "b", versions: ["1.0.0"] }],
    "GPL-3.0": [{ name: "c", versions: ["2.0.0"] }],
    "MIT AND AGPL-3.0": [{ name: "d", versions: ["1.0.0"] }],
    Unknown: [{ name: "e", versions: ["0.1.0"] }],
  };
  const found = findings(report);
  const expected = ["c@2.0.0: GPL-3.0", "d@1.0.0: MIT AND AGPL-3.0", "e@0.1.0: Unknown"];
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    process.stderr.write(`check-npm-licences self-test FAILED: ${JSON.stringify(found)}\n`);
    process.exit(1);
  }
  process.stdout.write("check-npm-licences self-test: ok\n");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  // Under `pnpm run`, npm_execpath is the pnpm that runs this workspace (the pinned version);
  // otherwise the `pnpm` on PATH.
  const execpath = process.env.npm_execpath ?? "";
  const viaRunner = /pnpm\.(c?js)$/.test(execpath);
  const raw = execFileSync(
    viaRunner ? process.execPath : "pnpm",
    [...(viaRunner ? [execpath] : []), "licenses", "list", "--prod", "--json"],
    { cwd: REPO, encoding: "utf8", shell: !viaRunner && process.platform === "win32" },
  );
  const report = raw.trim() === "" ? {} : JSON.parse(raw);
  const count = Object.values(report).reduce((n, list) => n + list.length, 0);
  const found = findings(report);
  if (found.length > 0) {
    process.stderr.write(
      `check-npm-licences: ${found.length} package(s) outside the allow-list\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `check-npm-licences: ok (${count} production packages, ${Object.keys(report).join(", ") || "none"})\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
