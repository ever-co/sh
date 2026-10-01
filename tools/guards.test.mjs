/**
 * The other repository checks: each one fails on a planted violation, passes on what is allowed,
 * and passes on the repository itself.
 *
 *   node --test tools/guards.test.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import * as canonical from "./check-canonical-origin.mjs";
import * as stack from "./check-frontend-stack.mjs";
import * as modules from "./check-image-modules.mjs";
import * as copy from "./check-public-copy.mjs";
import * as workflows from "./check-workflow-shape.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const run = (name, ...args) =>
  spawnSync(process.execPath, [join(TOOLS, `${name}.mjs`), ...args], {
    encoding: "utf8",
    env: { ...process.env, EVER_BANNED_PHRASES_JSON: "" },
  });

describe("repository checks", () => {
  for (const name of [
    "check-public-copy",
    "check-canonical-origin",
    "check-image-modules",
    "check-workflow-shape",
    "check-frontend-stack",
  ]) {
    it(`${name}: self-test and repository pass`, () => {
      const self = run(name, "--self-test");
      assert.equal(self.status, 0, self.stderr);
      const repo = run(name);
      assert.equal(repo.status, 0, repo.stderr);
    });
  }
});

describe("check-public-copy", () => {
  const rules = copy.compileList(["planted phrase", { pattern: "planted\\s+pattern\\d" }]);

  it("catches list phrases anywhere and prints only the rule number", () => {
    const found = copy.findings(
      "A Planted Phrase.\nthe planted  pattern7",
      "crates/api/src/x.rs",
      rules,
    );
    assert.deepEqual(found, [
      "crates/api/src/x.rs:1: phrase rule P1",
      "crates/api/src/x.rs:2: phrase rule P2",
    ]);
  });

  it("catches prices and SSO in site content only", () => {
    assert.equal(copy.findings("From $25 a month.", "content/products/x.md", []).length, 1);
    assert.equal(copy.findings("Use SSO.", "content/platform/x.md", []).length, 1);
    assert.equal(copy.findings("const x = `${y}`; // $5", "apps/web/src/x.ts", []).length, 0);
  });

  it("refuses an empty or malformed list", () => {
    assert.throws(() => copy.compileList([]));
    assert.throws(() => copy.compileList({ phrases: [42] }));
  });
});

describe("check-canonical-origin", () => {
  it("fails on a literal site origin and allows the marker", () => {
    assert.equal(canonical.findings('const u = "https://ever.sh/x";', "a.ts").length, 1);
    assert.equal(canonical.findings('const u = "https://dev.ever.sh";', "a.ts").length, 1);
    assert.equal(
      canonical.findings("const r = /https:\\/\\/ever\\.sh/; // canonical-origin: allow", "a.ts")
        .length,
      0,
    );
    assert.equal(canonical.findings("const u = `${SITE_ORIGIN}/x`;", "a.ts").length, 0);
  });
});

describe("check-image-modules", () => {
  it("finds a module serve.mjs needs that the Dockerfile does not copy", async () => {
    const sources = {
      "serve.mjs":
        'import "./a.mjs";\nimport { x } from "./b.mjs";\nawait import("./dist/server/entry-server.js");',
      "a.mjs": "export {};",
      "b.mjs": 'export { x } from "./c.mjs";',
      "c.mjs": "export const x = 1;",
    };
    const reachable = await modules.reachable("serve.mjs", async (p) => sources[p] ?? "");
    assert.deepEqual(reachable.sort(), ["b.mjs", "c.mjs", "serve.mjs"]);
    const copied = modules.copiedFiles(
      "COPY --from=builder /repo/apps/web/serve.mjs /repo/apps/web/b.mjs ./\n",
    );
    assert.deepEqual(modules.missing(reachable, copied, true), ["c.mjs", "dist"]);
  });
});

describe("check-workflow-shape", () => {
  const good = [
    "permissions:",
    "  contents: read",
    "jobs:",
    "  a:",
    "    runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.RUNNER_LINUX_X64_4 || 'ubuntu-latest' }}",
    "    steps:",
    "      - uses: actions/checkout@v7",
  ].join("\n");

  it("accepts the approved shape", () => {
    assert.deepEqual(workflows.findings(good, "ci.yml"), []);
  });

  it("refuses self-hosted runners for forks, writes, cluster access and unpinned actions", () => {
    const cases = [
      good.replace(/runs-on: .*/, "runs-on: self-hosted"),
      good.replace("contents: read", "contents: write"),
      `${good}\n      - run: kubectl get pods`,
      good.replace("checkout@v7", "checkout@main"),
      `${good}\n      - run: echo \${{ secrets.SOME_TOKEN }}`,
      good
        .replace("push", "pull_request_target")
        .replace("permissions:", "on: pull_request_target\npermissions:"),
    ];
    for (const text of cases) assert.ok(workflows.findings(text, "ci.yml").length > 0, text);
    assert.deepEqual(
      workflows.findings(good.replace("contents: read", "packages: write"), "k8s-build.yml"),
      [],
    );
  });
});

describe("check-frontend-stack", () => {
  it("refuses another UI framework", () => {
    assert.equal(stack.findings({ dependencies: { react: "19" } }, "p.json").length, 1);
    assert.equal(stack.findings({ dependencies: { "solid-js": "1.9.15" } }, "p.json").length, 0);
  });
});
