#!/usr/bin/env node
/**
 * Compiles the site's content at BUILD time into JSON the routes import:
 *
 *   content/products/<product>/<page>.md  → /<product> (index) and /<product>/<page>
 *   content/install/<product>.md          → /install/<product> (the install page's text)
 *   content/platform/<page>.md            → /platform/<page>
 *   content/hosting/index.md              → /hosting
 *     all of them                         → src/content.generated/pages.json
 *     and a plain Markdown twin of each   → public/<route>.md (for agents and readers of source)
 *   content/hosting/hosts.yaml            → src/content.generated/hosts.json, validated against
 *                                           content/hosting/hosts.schema.json
 *   content/stats/ever.stats.v1.schema.json (once vendored) → public/stats-schema.json
 *
 * Rules (the build fails on any of them):
 *   - front matter: `title`, `description`, `slug` (= the file name) and `order` on every page;
 *     product and install pages also cite their `sources` (repo, path, 40-hex commit sha) and the
 *     date they were `verified`, except pages marked `status: soon`;
 *   - no `# ` heading in a body: the title is the page's only top-level heading;
 *   - every internal link points at a page this build produces (or a fixed route such as
 *     `/hosting`); a link to a missing page is a build error, never a dead link on the site;
 *   - raw HTML in Markdown is escaped, never rendered; code blocks are highlighted here, so pages
 *     ship no highlighting script.
 *
 * Deterministic: sorted keys, no timestamps; a rebuild of unchanged content changes nothing.
 */
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { createHighlighter } from "shiki";
import { parse as parseYaml } from "yaml";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CONTENT = join(WEB, "..", "..", "content");

export const PRODUCTS = ["gauzy", "teams", "works", "rec", "traduora", "demand"];
export const INSTALLABLE = PRODUCTS.filter((p) => p !== "demand");
const SNIPPET_KINDS = new Set(["compose", "env", "helm"]);
const SHA = /^[0-9a-f]{40}$/;
const REPO = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]+$/;
/** Routes that exist without a content file. */
const FIXED_ROUTES = new Set(["/", "/hosting", "/robots.txt", "/sitemap.xml"]);
const LANG_ALIASES = { sh: "bash", shell: "bash", env: "dotenv", yml: "yaml" };

class ContentError extends Error {}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((err) => {
    if (err?.code === "ENOENT") return [];
    throw err;
  });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat().sort();
}

/** The route and the kind of page for a content file. */
function classify(contentDir, file) {
  const rel = relative(contentDir, file).split(sep).join("/");
  const parts = rel.replace(/\.md$/, "").split("/");
  const [section, a, b] = parts;
  if (section === "products" && parts.length === 3) {
    if (!PRODUCTS.includes(a)) throw new ContentError(`${rel}: unknown product "${a}"`);
    return { rel, kind: "product", product: a, route: b === "index" ? `/${a}` : `/${a}/${b}` };
  }
  if (section === "install" && parts.length === 2) {
    if (!INSTALLABLE.includes(a)) throw new ContentError(`${rel}: "${a}" has no install page`);
    return { rel, kind: "install", product: a, route: `/install/${a}` };
  }
  if (section === "platform" && parts.length === 2) {
    return { rel, kind: "platform", route: `/platform/${a}` };
  }
  if (section === "hosting" && parts.length === 2 && a === "index") {
    return { rel, kind: "hosting", route: "/hosting" };
  }
  throw new ContentError(`${rel}: no route for this content path`);
}

function checkFrontMatter(page, data, file) {
  const where = page.rel;
  const need = (cond, message) => {
    if (!cond) throw new ContentError(`${where}: ${message}`);
  };
  need(typeof data.title === "string" && data.title.trim() !== "", "front matter needs a title");
  need(
    typeof data.description === "string" && data.description.trim() !== "",
    "front matter needs a description",
  );
  need(typeof data.slug === "string" && SLUG.test(data.slug), "front matter needs a slug");
  need(data.slug === basename(file, ".md"), `slug must be "${basename(file, ".md")}"`);
  need(Number.isInteger(data.order), "front matter needs an integer order");
  need(
    data.status === undefined || ["available", "beta", "soon"].includes(data.status),
    "status must be available, beta or soon",
  );
  if (data.product !== undefined) need(data.product === page.product, "product does not match");
  const cites = (page.kind === "product" || page.kind === "install") && data.status !== "soon";
  if (cites) {
    need(Array.isArray(data.sources) && data.sources.length > 0, "front matter needs sources");
    for (const s of data.sources) {
      need(typeof s?.repo === "string" && REPO.test(s.repo), "sources[].repo must be owner/name");
      need(
        typeof s?.path === "string" &&
          s.path !== "" &&
          !s.path.startsWith("/") &&
          !s.path.includes(".."),
        "sources[].path must be a path in the repository",
      );
      need(typeof s?.sha === "string" && SHA.test(s.sha), "sources[].sha must be a 40-hex commit");
    }
    const verified =
      data.verified instanceof Date ? data.verified.toISOString().slice(0, 10) : data.verified;
    need(typeof verified === "string" && DATE.test(verified), "front matter needs a verified date");
    data.verified = verified;
  }
  if (page.kind === "install") {
    need(
      Array.isArray(data.snippets) &&
        data.snippets.length > 0 &&
        data.snippets.every((k) => SNIPPET_KINDS.has(k)),
      "install pages list their snippets (compose, env, helm)",
    );
  }
}

/** Every href of a rendered token stream, and whether the body has a top-level heading. */
function inspect(tokens) {
  const hrefs = [];
  let h1 = false;
  const visit = (list) => {
    for (const t of list) {
      if (t.type === "heading_open" && t.tag === "h1") h1 = true;
      if (t.type === "link_open") hrefs.push(t.attrGet("href") ?? "");
      if (t.children) visit(t.children);
    }
  };
  visit(tokens);
  return { hrefs, h1 };
}

let renderer;

/** One Markdown renderer (and one highlighter) per process. */
function markdownRenderer() {
  renderer ??= createRenderer();
  return renderer;
}

async function createRenderer() {
  const highlighter = await createHighlighter({
    themes: ["github-dark"],
    langs: ["bash", "yaml", "dotenv", "json"],
  });
  const loaded = new Set(highlighter.getLoadedLanguages());
  return new MarkdownIt({
    html: false,
    linkify: false,
    typographer: true,
    highlight: (code, rawLang) => {
      const lang = LANG_ALIASES[rawLang] ?? rawLang;
      return loaded.has(lang) ? highlighter.codeToHtml(code, { lang, theme: "github-dark" }) : "";
    },
  });
}

/**
 * Compiles every Markdown page under `contentDir`. Throws a ContentError on the first rule broken.
 * @returns {Promise<{ pages: Record<string, object>, twins: Record<string, string> }>}
 */
export async function compilePages(contentDir) {
  const md = await markdownRenderer();
  const pages = {};
  const twins = {};
  const links = [];
  const files = (await walk(contentDir)).filter(
    (f) => f.endsWith(".md") && !relative(contentDir, f).startsWith(`stats${sep}`),
  );
  for (const file of files) {
    const page = classify(contentDir, file);
    const { data, content } = matter(await readFile(file, "utf8"));
    checkFrontMatter(page, data, file);
    const tokens = md.parse(content, {});
    const { hrefs, h1 } = inspect(tokens);
    if (h1)
      throw new ContentError(`${page.rel}: the body has a "# " heading; the title is the only one`);
    for (const href of hrefs) links.push({ from: page.rel, href });
    pages[page.route] = {
      kind: page.kind,
      ...(page.product ? { product: page.product } : {}),
      slug: data.slug,
      title: data.title.trim(),
      description: data.description.trim(),
      order: data.order,
      status: data.status ?? "available",
      ...(data.sources
        ? { sources: data.sources.map(({ repo, path, sha }) => ({ repo, path, sha })) }
        : {}),
      ...(data.verified ? { verified: data.verified } : {}),
      ...(data.snippets ? { snippets: data.snippets } : {}),
      html: md.renderer.render(tokens, md.options, {}),
    };
    twins[page.route] = `# ${data.title.trim()}\n\n${content.trim()}\n`;
  }
  const known = new Set([...FIXED_ROUTES, ...Object.keys(pages)]);
  for (const { from, href } of links) {
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    if (!known.has(path))
      throw new ContentError(`${from}: link to "${href}", which is not a page of this site`);
  }
  return { pages, twins };
}

/**
 * Reads `hosting/hosts.yaml` and validates it against `hosting/hosts.schema.json`.
 * @returns {Promise<object>}
 */
export async function loadHosts(contentDir) {
  const schema = JSON.parse(
    await readFile(join(contentDir, "hosting", "hosts.schema.json"), "utf8"),
  );
  const doc = parseYaml(await readFile(join(contentDir, "hosting", "hosts.yaml"), "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(doc)) {
    const detail = (validate.errors ?? [])
      .slice(0, 10)
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join("; ");
    throw new ContentError(`hosting/hosts.yaml does not match hosts.schema.json: ${detail}`);
  }
  return doc;
}

async function removeTwins(dir) {
  for (const file of await walk(dir)) if (file.endsWith(".md")) await rm(file);
}

async function main() {
  const out = join(WEB, "src", "content.generated");
  const publicDir = join(WEB, "public");
  const { pages, twins } = await compilePages(DEFAULT_CONTENT);
  const hosts = await loadHosts(DEFAULT_CONTENT);

  await removeTwins(publicDir);
  for (const [route, text] of Object.entries(twins)) {
    const twin = join(publicDir, `${route.slice(1)}.md`);
    await mkdir(dirname(twin), { recursive: true });
    await writeFile(twin, text, "utf8");
  }
  // The statistics schema is vendored from the Ever Platform once published; until then the site
  // neither serves nor links it.
  await rm(join(publicDir, "stats-schema.json"), { force: true });
  await copyFile(
    join(DEFAULT_CONTENT, "stats", "ever.stats.v1.schema.json"),
    join(publicDir, "stats-schema.json"),
  ).catch((err) => {
    if (err?.code !== "ENOENT") throw err;
  });

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(join(out, "pages.json"), `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  await writeFile(join(out, "hosts.json"), `${JSON.stringify(hosts, null, 2)}\n`, "utf8");
  process.stdout.write(
    `content: ${Object.keys(sorted).length} pages, ${hosts.targets.length} hosting targets (as of ${hosts.as_of})\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`build-content: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
