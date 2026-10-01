/**
 * ever.sh production server: static files, server rendering, the site's HTTP rules. Nothing else.
 *
 *   - `/healthz` answers from this process, without rendering or calling anything;
 *   - redirects and response headers come from `http-policy.mjs` (pure, unit-tested);
 *   - built assets (`/_build/assets/*`, hashed) are immutable; other files of `dist/client` are
 *     revalidated on every use;
 *   - everything else goes to the SolidStart handler (`dist/server/entry-server.js`, `app.fetch`);
 *     a runtime-free page (`runtime-free.mjs`) is sent without any script or module preload;
 *   - no response ever sets a cookie.
 *
 * There is NO API proxy: this server never forwards a browser request anywhere. The site's only
 * outbound read is the server-side hosting list (`src/server/targets.ts`).
 *
 * Every local module imported here is also COPYed by deploy/docker/web/Dockerfile;
 * tools/check-image-modules.mjs enforces it.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { policyHeaders, redirectFor } from "./http-policy.mjs";
import { isRuntimeFree, stripRuntime } from "./runtime-free.mjs";
import { INDEXABLE, SITE_ORIGIN } from "./site-origin.mjs";

const { default: app } = await import("./dist/server/entry-server.js");
const render = app.fetch.bind(app);

const CLIENT = resolve(import.meta.dirname, "dist", "client");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
};

/** Serves a file of the client build; false when there is none for this path. */
async function serveStatic(pathname, method, res) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decoded.includes("\0")) return false;
  // Resolve, then check containment: "../" must never escape the client directory.
  const file = resolve(join(CLIENT, decoded));
  if (!file.startsWith(CLIENT + sep)) return false;
  try {
    if (!(await stat(file)).isFile()) return false;
  } catch {
    return false;
  }
  res.statusCode = 200;
  res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
  res.setHeader(
    "cache-control",
    pathname.startsWith("/_build/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  );
  if (method === "HEAD") {
    res.end();
    return true;
  }
  await pipeline(createReadStream(file), res);
  return true;
}

async function serveRendered(req, res, url) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  const head = req.method === "HEAD";
  const hasBody = !head && req.method !== "GET";
  const response = await render(
    new Request(url, {
      // The renderer answers HEAD as GET; the body is simply not sent.
      method: head ? "GET" : req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: "half",
    }),
  );
  res.statusCode = response.status;
  for (const [name, value] of response.headers) {
    // Never a cookie; never a header the site policy already set; the length is ours to compute.
    if (name === "set-cookie" || name === "content-length" || res.hasHeader(name)) continue;
    res.setHeader(name, value);
  }
  const html = (response.headers.get("content-type") ?? "").startsWith("text/html");
  if (html) res.setHeader("content-type", "text/html; charset=utf-8");
  if (head || !response.body) {
    await response.body?.cancel();
    res.end();
    return;
  }
  if (html && isRuntimeFree(url.pathname)) {
    // Fully rendered on the server (deferred data included): buffer it and drop the runtime.
    const body = stripRuntime(await response.text());
    res.removeHeader("transfer-encoding");
    res.setHeader("content-length", Buffer.byteLength(body));
    res.end(body);
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
}

const server = createServer(async (req, res) => {
  try {
    const target = req.url ?? "/";
    // Origin-form targets only ("/path?query"); the URL is built on the site origin, never on
    // the Host header or an absolute-form target.
    if (!target.startsWith("/")) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Bad request\n");
      return;
    }
    const url = new URL(`${SITE_ORIGIN}${target}`);
    for (const [name, value] of Object.entries(policyHeaders(url, { indexable: INDEXABLE }))) {
      res.setHeader(name, value);
    }
    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end('{"status":"ok","service":"ever-sh-web"}\n');
      return;
    }
    const redirect = redirectFor(url, SITE_ORIGIN);
    if (redirect) {
      res.writeHead(redirect.status, { location: redirect.location });
      res.end();
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      if (await serveStatic(url.pathname, req.method, res)) return;
    }
    await serveRendered(req, res, url);
  } catch (err) {
    if (err?.code === "ERR_STREAM_PREMATURE_CLOSE") return;
    process.stderr.write(`ever.sh: ${err instanceof Error ? err.stack : String(err)}\n`);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Internal error\n");
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`ever.sh on http://${HOST}:${PORT} (public origin ${SITE_ORIGIN})\n`);
});

// A pod deletion sends SIGTERM: stop accepting, let open requests finish, then exit.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
