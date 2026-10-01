/**
 * The content build's rules, run against small content trees written to a temporary directory:
 * a tree that follows the rules compiles; each broken rule fails the build with its reason.
 *
 *   node --test tools/build-content.test.mjs
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { compilePages, loadHosts } from "./build-content.mjs";

const REAL_CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content");
const SHA = "367a01a66da637257313b0321fb60d10bc5ea1ef";
const roots = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function tree(files) {
  const root = await mkdtemp(join(tmpdir(), "ever-sh-content-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text, "utf8");
  }
  return root;
}

function page(front, body = "Some text.\n") {
  const lines = Object.entries(front).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

const SOURCES = `\n  - repo: ever-co/ever-gauzy\n    path: README.md\n    sha: "${SHA}"`;
const guide = (over = {}, body) =>
  page(
    {
      title: "Guide",
      description: "A guide.",
      slug: "index",
      order: 0,
      sources: SOURCES,
      verified: "2026-10-01",
      ...over,
    },
    body,
  );
const VALID = {
  "products/gauzy/index.md": guide(
    {},
    "See [Docker](/gauzy/docker), [hosting](/hosting?product=gauzy).\n",
  ),
  "products/gauzy/docker.md": guide({ slug: "docker", order: 10 }, "Back to [Gauzy](/gauzy).\n"),
  "products/demand/index.md": page({
    title: "Demand",
    description: "Soon.",
    slug: "index",
    order: 0,
    status: "soon",
  }),
  "install/gauzy.md": guide(
    { slug: "gauzy", snippets: "[compose, env]" },
    "Read [Connect](/platform/connect).\n",
  ),
  "platform/connect.md": page({
    title: "Connect",
    description: "Explainer.",
    slug: "connect",
    order: 10,
  }),
  "hosting/index.md": page({
    title: "Where to host",
    description: "Chooser.",
    slug: "index",
    order: 0,
  }),
};

async function rejects(files, reason) {
  await assert.rejects(compilePages(await tree(files)), (err) => {
    assert.match(err.message, reason);
    return true;
  });
}

describe("build-content", () => {
  it("compiles a tree that follows the rules", async () => {
    const { pages, twins } = await compilePages(await tree(VALID));
    assert.deepEqual(Object.keys(pages).sort(), [
      "/demand",
      "/gauzy",
      "/gauzy/docker",
      "/hosting",
      "/install/gauzy",
      "/platform/connect",
    ]);
    assert.equal(pages["/gauzy/docker"].sources[0].sha, SHA);
    assert.equal(pages["/gauzy/docker"].verified, "2026-10-01");
    assert.deepEqual(pages["/install/gauzy"].snippets, ["compose", "env"]);
    assert.equal(pages["/demand"].status, "soon");
    assert.match(twins["/gauzy"], /^# Guide\n\nSee \[Docker\]/);
    assert.doesNotMatch(twins["/gauzy"], /^---/m, "the twin carries no front matter");
  });

  it("escapes raw HTML in Markdown", async () => {
    const files = {
      ...VALID,
      "platform/connect.md": page(
        { title: "C", description: "D", slug: "connect", order: 1 },
        "<script>x()</script>\n",
      ),
    };
    const { pages } = await compilePages(await tree(files));
    assert.doesNotMatch(pages["/platform/connect"].html, /<script>/);
  });

  it("compiles the real content", async () => {
    const { pages } = await compilePages(REAL_CONTENT);
    assert.ok(pages["/gauzy"] && pages["/hosting"] && pages["/install/gauzy"]);
    assert.equal(pages["/install/demand"], undefined);
    const hosts = await loadHosts(REAL_CONTENT);
    assert.equal(hosts.schema, "ever.hosting-targets.v1");
  });

  for (const [name, field, reason] of [
    ["a title", "title", /needs a title/],
    ["a description", "description", /needs a description/],
    ["a slug", "slug", /needs a slug/],
    ["an order", "order", /integer order/],
    ["sources", "sources", /needs sources/],
    ["a verified date", "verified", /verified date/],
  ]) {
    it(`fails on a product page without ${name}`, async () => {
      const front = {
        title: "G",
        description: "D",
        slug: "docker",
        order: 10,
        sources: SOURCES,
        verified: "2026-10-01",
      };
      delete front[field];
      await rejects({ ...VALID, "products/gauzy/docker.md": page(front) }, reason);
    });
  }

  it("fails on a source without a 40-hex commit", async () => {
    const bad = `\n  - repo: ever-co/ever-gauzy\n    path: README.md\n    sha: develop`;
    await rejects(
      { ...VALID, "products/gauzy/docker.md": guide({ slug: "docker", sources: bad }) },
      /40-hex/,
    );
  });

  it("fails on a slug that is not the file name", async () => {
    await rejects(
      { ...VALID, "products/gauzy/docker.md": guide({ slug: "dockr" }) },
      /slug must be "docker"/,
    );
  });

  it("fails on a link to a page that does not exist", async () => {
    await rejects(
      {
        ...VALID,
        "products/gauzy/docker.md": guide(
          { slug: "docker" },
          "See [Kubernetes](/gauzy/kubernetes).\n",
        ),
      },
      /link to "\/gauzy\/kubernetes"/,
    );
  });

  it("fails on a top-level heading in the body", async () => {
    await rejects(
      { ...VALID, "products/gauzy/docker.md": guide({ slug: "docker" }, "# Again\n\nText.\n") },
      /"# " heading/,
    );
  });

  it("fails on an unknown product or an install page for Ever Demand", async () => {
    await rejects({ ...VALID, "products/iq/index.md": guide() }, /unknown product "iq"/);
    await rejects(
      { ...VALID, "install/demand.md": guide({ slug: "demand", snippets: "[env]" }) },
      /has no install page/,
    );
  });

  it("fails on an install page without its snippet kinds", async () => {
    await rejects(
      { ...VALID, "install/gauzy.md": guide({ slug: "gauzy" }) },
      /list their snippets/,
    );
    await rejects(
      { ...VALID, "install/gauzy.md": guide({ slug: "gauzy", snippets: "[docker]" }) },
      /list their snippets/,
    );
  });

  it("fails on a hosting list that does not match its schema", async () => {
    const real = await loadHosts(REAL_CONTENT);
    const schema = await import("node:fs/promises").then((fs) =>
      fs.readFile(join(REAL_CONTENT, "hosting", "hosts.schema.json"), "utf8"),
    );
    const broken = {
      ...real,
      targets: [{ ...real.targets[0], products: [{ id: "demand", status: "available" }] }],
    };
    const root = await tree({
      "hosting/hosts.schema.json": schema,
      "hosting/hosts.yaml": JSON.stringify(broken),
    });
    await assert.rejects(loadHosts(root), /does not match hosts\.schema\.json/);
  });
});
