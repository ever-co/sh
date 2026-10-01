#!/usr/bin/env node
/**
 * Refreshes the hosting list from the public Ever Platform API:
 *
 *   node tools/refresh-targets.mjs --api https://api.ever.co --out content/hosting/hosts.yaml
 *
 * Reads `GET <api>/v1/hosting-targets` (no credential), keeps the fields of
 * content/hosting/hosts.schema.json in schema order, and rewrites the YAML with today's `as_of`,
 * keeping the file's comment header. Refuses to write an empty list: an outage must never empty
 * the chooser. Review the diff before committing; CI validates the result against the schema.
 */
import { readFile, writeFile } from "node:fs/promises";

import { stringify } from "yaml";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const API = arg("api", "https://api.ever.co");
const OUT = arg("out", "content/hosting/hosts.yaml");
const FIELDS = [
  "id",
  "kind",
  "title",
  "summary_md",
  "requirements_md",
  "docs_url",
  "badge",
  "products",
  "install_source",
  "link_template",
  "snippet_kind",
  "referral",
  "order",
  "status",
];

const res = await fetch(new URL("/v1/hosting-targets", API), {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(15_000),
});
if (!res.ok) throw new Error(`GET /v1/hosting-targets: HTTP ${res.status}`);
const body = await res.json();
const items = Array.isArray(body.items) ? body.items : [];
if (items.length === 0)
  throw new Error("the API returned no hosting targets; the list is left unchanged");

/** Schema order; absent optional fields left out; `referral` always present (`null` when none). */
const targets = items.map((t) =>
  Object.fromEntries(
    FIELDS.filter((f) => f === "referral" || (t[f] !== undefined && t[f] !== null)).map((f) => [
      f,
      t[f] ?? null,
    ]),
  ),
);
const header = (await readFile(OUT, "utf8"))
  .split("\n")
  .filter((line) => line.startsWith("#"))
  .join("\n");
const doc = {
  schema: "ever.hosting-targets.v1",
  as_of: new Date().toISOString().slice(0, 10),
  targets,
};
await writeFile(OUT, `${header}\n${stringify(doc, { lineWidth: 0 })}`, "utf8");
process.stdout.write(`wrote ${targets.length} hosting targets to ${OUT}\n`);
