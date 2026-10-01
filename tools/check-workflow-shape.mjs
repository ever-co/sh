#!/usr/bin/env node
/**
 * check-workflow-shape: the CI workflows keep the shape a public repository needs.
 *
 *   - every job runs on our runners only for our own branches and pull requests: `runs-on` sends a
 *     pull request from a fork to `ubuntu-latest` and falls back to `ubuntu-latest` when the
 *     runner variables are absent (a fork, or a repository outside the organisation); a job may
 *     also name `ubuntu-latest` alone;
 *   - permissions are declared and read-only, except `packages: write` (k8s-build.yml, to push
 *     images) and `security-events: write` (codeql.yml, to upload results);
 *   - no `pull_request_target` (it runs fork code with this repository's secrets);
 *   - nothing reaches a cluster (no kubectl, helm, argocd or kubeconfig);
 *   - secrets: only `GITHUB_TOKEN` and the phrase list; variables: only the runner labels (an
 *     internal address would print in public logs);
 *   - every action is pinned to a version tag or a commit, never a branch.
 *
 *   node tools/check-workflow-shape.mjs
 *   node tools/check-workflow-shape.mjs --self-test
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WORKFLOWS = join(REPO, ".github", "workflows");
const FORK_ROUTE = "github.event.pull_request.head.repo.fork && 'ubuntu-latest'";
const WRITE_ALLOWED = { packages: ["k8s-build.yml"], "security-events": ["codeql.yml"] };
const SECRETS = new Set(["GITHUB_TOKEN", "EVER_BANNED_PHRASES_JSON"]);
const VARIABLE = /^RUNNER_LINUX_X64_\d+$/;

/** Findings in one workflow file. */
export function findings(text, name) {
  const out = [];
  const lines = text.split("\n");
  const add = (i, message) => out.push(`${name}:${i + 1}: ${message}`);
  if (!/^permissions:/m.test(text)) out.push(`${name}: no top-level permissions block`);
  let inPermissions = -1;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "");
    const indent = line.length - line.trimStart().length;
    if (/^\s*permissions:\s*$/.test(line)) {
      inPermissions = indent;
      return;
    }
    if (inPermissions >= 0) {
      if (line.trim() !== "" && indent <= inPermissions) inPermissions = -1;
      else {
        const m = /^\s*([a-z-]+):\s*(\w+)/.exec(line);
        if (m && m[2] === "write" && !(WRITE_ALLOWED[m[1]] ?? []).includes(name))
          add(i, `${m[1]}: write is not allowed here`);
      }
    }
    if (/^\s*permissions:\s*write-all/.test(line)) add(i, "write-all permissions");
    const runsOn = /^\s*runs-on:\s*(.+)$/.exec(line);
    if (runsOn) {
      const value = runsOn[1].trim();
      const plain = value === "ubuntu-latest";
      const routed = value.includes(FORK_ROUTE) && /\|\|\s*'ubuntu-latest'\s*}}$/.test(value);
      if (!plain && !routed)
        add(i, "runs-on must route forks to ubuntu-latest and fall back to it");
    }
    if (/pull_request_target/.test(line)) add(i, "pull_request_target is not allowed");
    if (/\b(kubectl|helm|argocd|kubeconfig|KUBECONFIG)\b/.test(line))
      add(i, "cluster tooling in a workflow");
    for (const m of line.matchAll(/\bsecrets\.([A-Za-z0-9_]+)/g)) {
      if (!SECRETS.has(m[1])) add(i, `secret ${m[1]} is not allowed`);
    }
    for (const m of line.matchAll(/\bvars\.([A-Za-z0-9_]+)/g)) {
      if (!VARIABLE.test(m[1])) add(i, `variable ${m[1]} is not allowed`);
    }
    const uses = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(line);
    if (uses && !uses[1].startsWith("./") && !/@(v\d+(\.\d+){0,2}|[0-9a-f]{40})$/.test(uses[1])) {
      add(i, `action ${uses[1]} is not pinned to a version`);
    }
  });
  return out;
}

const GOOD = `name: ok
on: { push: { branches: [develop] } }
permissions:
  contents: read
jobs:
  build:
    runs-on: \${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.RUNNER_LINUX_X64_4 || 'ubuntu-latest' }}
    steps:
      - uses: actions/checkout@v7
      - run: echo ok
        env:
          TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const BAD = [
  ["no permissions", GOOD.replace("permissions:\n  contents: read\n", "")],
  ["write", GOOD.replace("contents: read", "contents: write")],
  ["runner", GOOD.replace(/runs-on: .*/, "runs-on: ${{ vars.RUNNER_LINUX_X64_4 }}")],
  ["target", GOOD.replace("push: { branches: [develop] }", "pull_request_target: {}")],
  ["cluster", GOOD.replace("echo ok", "kubectl apply -f x.yaml")],
  ["secret", GOOD.replace("secrets.GITHUB_TOKEN", "secrets.DEPLOY_KEY")],
  ["variable", GOOD.replace("echo ok", "echo ${{ vars.INTERNAL_REGISTRY }}")],
  ["unpinned", GOOD.replace("actions/checkout@v7", "actions/checkout@main")],
];

function selfTest() {
  const good = findings(GOOD, "ci.yml");
  const missed = BAD.filter(([, text]) => findings(text, "ci.yml").length === 0).map(
    ([label]) => label,
  );
  if (good.length > 0 || missed.length > 0) {
    process.stderr.write(
      `check-workflow-shape self-test FAILED: good=${JSON.stringify(good)} missed=${JSON.stringify(missed)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`check-workflow-shape self-test: ok (${BAD.length} planted, all caught)\n`);
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const names = (await readdir(WORKFLOWS)).filter((n) => /\.ya?ml$/.test(n)).sort();
  const found = [];
  for (const name of names)
    found.push(...findings(await readFile(join(WORKFLOWS, name), "utf8"), name));
  if (found.length > 0) {
    process.stderr.write(
      `check-workflow-shape: ${found.length} finding(s)\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`check-workflow-shape: ok (${names.join(", ")})\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
