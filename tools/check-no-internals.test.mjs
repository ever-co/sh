/**
 * check-no-internals against its negative control: the fixture holds one violation per rule and
 * must fail with exactly one finding per line; the repository itself must pass.
 *
 *   node --test tools/check-no-internals.test.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CLEAN, PLANTED, violations } from "./check-no-internals.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const CHECK = join(TOOLS, "check-no-internals.mjs");
const CONTROL = join(TOOLS, "fixtures", "internals-control");

const run = (...args) => spawnSync(process.execPath, [CHECK, ...args], { encoding: "utf8" });

describe("check-no-internals", () => {
  it("fails on the negative control with one finding per line, and never prints the match", () => {
    const result = run("--root", CONTROL);
    assert.equal(result.status, 1);
    const lines = readFileSync(join(CONTROL, "control.txt"), "utf8").trimEnd().split("\n");
    const findings = result.stderr.split("\n").filter((l) => l.trim().startsWith("control.txt:"));
    assert.equal(findings.length, lines.length);
    lines.forEach((_, i) => {
      assert.ok(
        findings.some((f) => f.trim().startsWith(`control.txt:${i + 1}:`)),
        `line ${i + 1}`,
      );
    });
    for (const secretish of ["kv/shop", "10.1.2.3", "build-box", "sk_live", "wiki.corp"]) {
      assert.ok(!result.stderr.includes(secretish), `the output repeats "${secretish}"`);
    }
  });

  it("passes on the repository", () => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
  });

  it("passes its self-test, which catches every planted line", () => {
    assert.equal(run("--self-test").status, 0);
    for (const line of PLANTED) assert.ok(violations(line).length > 0, line);
    for (const line of CLEAN) assert.deepEqual(violations(line), [], line);
  });
});
