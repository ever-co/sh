#!/usr/bin/env node
/**
 * check-public-copy: the words on this public site, and in this public repository, stay public.
 *
 * Two sets of rules:
 *   - a phrase list kept outside the repository, read from the environment variable
 *     `EVER_BANNED_PHRASES_JSON` (a CI secret) or from `--phrases <file>` (a local, git-ignored
 *     copy at `tools/banned-phrases.private.json` is picked up too). Without one, those rules are
 *     skipped with a note: forks and fresh clones build without it;
 *   - generic rules that need no list: no prices and no "SSO" in the site's content.
 *
 * A finding prints the file, the line and the rule NUMBER, never the phrase: the list stays out
 * of public CI logs.
 *
 * Phrase list format (JSON): an array whose items are strings (matched case-insensitively as
 * whole words) or `{ "pattern": "<regex>", "flags": "i" }` objects; or an object with `phrases`
 * and/or `patterns` arrays of the same items.
 *
 *   node tools/check-public-copy.mjs                    scan the repository
 *   node tools/check-public-copy.mjs --commits <range>  also scan the commit messages of <range>
 *   node tools/check-public-copy.mjs --self-test        prove each kind of rule can fail
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const LOCAL_LIST = join(REPO, "tools", "banned-phrases.private.json");
const SCAN_DIRS = ["apps", "crates", "content", "tools", "deploy", ".github"];
const ROOT_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SECURITY.md",
  "CODEOWNERS",
  "justfile",
  "package.json",
  "Cargo.toml",
  "deny.toml",
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
const SELF = new Set(["tools/check-public-copy.mjs", "tools/guards.test.mjs"]);
const TEXT =
  /\.(m?[jt]sx?|json|ya?ml|md|css|html|txt|sh|rs|toml)$|(^|[\\/])(Dockerfile|justfile|CODEOWNERS)$/;

/** Rules that need no list; `scope` limits a rule to the site's content. */
const GENERIC = [
  { id: "G1", label: "a price in site content", re: /(^|[^\w$])[$€£]\s?\d/, scope: "content/" },
  { id: "G2", label: '"SSO" in site content', re: /\bSSO\b/, scope: "content/" },
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compiles a phrase list document into numbered rules. Throws on a malformed list. */
export function compileList(doc) {
  const items = Array.isArray(doc) ? doc : [...(doc?.phrases ?? []), ...(doc?.patterns ?? [])];
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("the phrase list is empty or malformed");
  return items.map((item, i) => {
    const id = `P${i + 1}`;
    if (typeof item === "string") {
      const left = /^\w/.test(item) ? "\\b" : "";
      const right = /\w$/.test(item) ? "\\b" : "";
      return {
        id,
        re: new RegExp(`${left}${escapeRegExp(item).replace(/\s+/g, "\\s+")}${right}`, "i"),
      };
    }
    const source = item?.pattern ?? item?.phrase;
    if (typeof source !== "string") throw new Error(`phrase list item ${i + 1} is malformed`);
    const flags = typeof item.flags === "string" ? item.flags.replace(/[gy]/g, "") : "i";
    return {
      id,
      re: item.pattern
        ? new RegExp(source, flags)
        : new RegExp(`\\b${escapeRegExp(source)}\\b`, "i"),
    };
  });
}

/** Findings in one text: `file:line: rule <id>` strings. */
export function findings(text, file, phraseRules) {
  const out = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const rule of phraseRules)
      if (rule.re.test(line)) out.push(`${file}:${i + 1}: phrase rule ${rule.id}`);
    for (const rule of GENERIC) {
      if (rule.scope && !file.startsWith(rule.scope)) continue;
      if (rule.re.test(line)) out.push(`${file}:${i + 1}: ${rule.id} (${rule.label})`);
    }
  });
  return out;
}

function loadList(args) {
  const i = args.indexOf("--phrases");
  if (i >= 0)
    return { source: "file", doc: JSON.parse(readFileSync(resolve(args[i + 1] ?? ""), "utf8")) };
  const env = process.env.EVER_BANNED_PHRASES_JSON;
  if (env && env.trim() !== "") return { source: "secret", doc: JSON.parse(env) };
  if (existsSync(LOCAL_LIST))
    return { source: "local file", doc: JSON.parse(readFileSync(LOCAL_LIST, "utf8")) };
  return { source: null, doc: null };
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(path);
    } else if (TEXT.test(e.name)) {
      yield path;
    }
  }
}

async function scanRepository(phraseRules) {
  const files = [];
  for (const dir of SCAN_DIRS) for await (const f of walk(join(REPO, dir))) files.push(f);
  for (const f of ROOT_FILES) files.push(join(REPO, f));
  const out = [];
  for (const file of files) {
    const rel = relative(REPO, file).split(sep).join("/");
    if (SELF.has(rel)) continue;
    const text = await readFile(file, "utf8").catch(() => null);
    if (text !== null) out.push(...findings(text, rel, phraseRules));
  }
  return out;
}

function scanCommits(range, phraseRules) {
  const log = execFileSync("git", ["log", "--format=%H%n%B%n--end--", range], {
    cwd: REPO,
    encoding: "utf8",
  });
  const out = [];
  for (const block of log.split("--end--\n").filter((b) => b.trim() !== "")) {
    const [sha = "", ...body] = block.split("\n");
    out.push(...findings(body.join("\n"), `commit ${sha.slice(0, 12)}`, phraseRules));
  }
  return out;
}

function selfTest() {
  const rules = compileList({
    phrases: ["forbidden phrase", "Codename"],
    patterns: [{ pattern: "secret\\s+plan\\b" }],
  });
  const planted = [
    ["content/products/x.md", "This is a Forbidden  Phrase here."],
    ["apps/web/src/x.tsx", "<p>codename</p>"],
    ["crates/api/src/x.rs", "// the secret plan"],
    ["content/platform/x.md", "Plans from $25 a month."],
    ["content/platform/y.md", "Sign in with SSO."],
  ];
  const clean = [
    ["content/x.md", "A permitted sentence about codenames-free text; costs nothing."],
    ["apps/web/src/x.ts", "const price = `${amount}`; // $1 outside content is not a page price"],
  ];
  const missed = planted.filter(([file, text]) => findings(text, file, rules).length === 0);
  const falsePositives = clean.flatMap(([file, text]) => findings(text, file, rules));
  const leaks = planted
    .flatMap(([file, text]) => findings(text, file, rules))
    .filter((f) => /forbidden|codename|secret/i.test(f));
  if (missed.length > 0 || falsePositives.length > 0 || leaks.length > 0) {
    process.stderr.write(
      `check-public-copy self-test FAILED: ${missed.length} missed, ${falsePositives.length} false positive(s), ${leaks.length} finding(s) printing the phrase\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`check-public-copy self-test: ok (${planted.length} planted, all caught)\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  const { source, doc } = loadList(args);
  let phraseRules = [];
  if (source) {
    phraseRules = compileList(doc);
    process.stdout.write(
      `check-public-copy: ${phraseRules.length} phrase rule(s) from the ${source}\n`,
    );
  } else {
    process.stdout.write(
      "check-public-copy: no phrase list (EVER_BANNED_PHRASES_JSON unset): phrase rules skipped\n",
    );
  }
  const found = await scanRepository(phraseRules);
  const c = args.indexOf("--commits");
  if (c >= 0) found.push(...scanCommits(args[c + 1] ?? "HEAD", phraseRules));
  if (found.length > 0) {
    process.stderr.write(
      `check-public-copy: ${found.length} finding(s)\n  ${found.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("check-public-copy: ok\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
