/**
 * The site's HTTP rules that do not need the framework: redirects and response headers. Pure
 * functions, imported by `serve.mjs` (production) and unit-tested (`test/http-policy.test.ts`).
 *
 * Redirects (one hop each; the Location is absolute, built from the site origin):
 *   - an upper-case page path            → 301 to the lower-case path
 *   - a page path with a trailing slash  → 308 to the path without it
 *   - `/<product>?connect=<…>`           → 308 to `/install/<product>?connect=<…>` (older link shape)
 *   - `/install` (no product)            → 308 to `/hosting`
 * Built assets (`/_build/…`), framework endpoints (`/_…`) and files (a dot in the last segment)
 * are never rewritten.
 *
 * Headers on every response: no framing, a strict referrer policy, no MIME sniffing, and
 * `noindex` unless the deployment is indexable. A request that carries a connect code
 * (`/install/<product>?connect=…`) is personal: `noindex`, `no-store`, and `no-referrer` so the
 * code never leaks through the Referer of an outbound click.
 */

/** Products with an install page (Ever Demand is "soon" and has none). */
export const INSTALLABLE = Object.freeze(["gauzy", "teams", "works", "rec", "traduora"]);

export const BASE_HEADERS = Object.freeze({
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
});

const PAGE_PATH = /^\/[A-Za-z0-9/_-]*$/;

/** True for a path the site renders as a page (not an asset, a file or a framework endpoint). */
function isPagePath(pathname) {
  return PAGE_PATH.test(pathname) && !pathname.startsWith("/_");
}

/**
 * The redirect for a request URL, or null. The Location is the site origin followed by a path
 * that starts with exactly one slash, so it can never point at another host.
 * @param {URL} url the request URL
 * @param {string} siteOrigin the validated public origin
 * @returns {{ status: 301 | 308, location: string } | null}
 */
export function redirectFor(url, siteOrigin) {
  const { pathname, search, searchParams } = url;
  if (!isPagePath(pathname)) return null;
  const normalized = pathname
    .replace(/\/{2,}/g, "/")
    .replace(/(.)\/+$/, "$1")
    .toLowerCase();
  if (normalized !== pathname) {
    const status = pathname === pathname.toLowerCase() ? 308 : 301;
    return { status, location: `${siteOrigin}${normalized}${search}` };
  }
  if (pathname === "/install") {
    return { status: 308, location: `${siteOrigin}/hosting` };
  }
  const product = pathname.slice(1);
  if (INSTALLABLE.includes(product) && searchParams.has("connect")) {
    return { status: 308, location: `${siteOrigin}/install/${product}${search}` };
  }
  return null;
}

/**
 * True when the request carries a connect code (the page is personal).
 * @param {URL} url
 */
export function carriesConnectCode(url) {
  return url.pathname.startsWith("/install/") && url.searchParams.has("connect");
}

/**
 * Headers every response to `url` carries; they win over anything the renderer set.
 * @param {URL} url the request URL
 * @param {{ indexable: boolean }} options
 * @returns {Record<string, string>}
 */
export function policyHeaders(url, { indexable }) {
  const headers = { ...BASE_HEADERS };
  if (!indexable) headers["x-robots-tag"] = "noindex";
  if (carriesConnectCode(url)) {
    headers["x-robots-tag"] = "noindex";
    headers["referrer-policy"] = "no-referrer";
    headers["cache-control"] = "private, no-store";
  }
  return headers;
}
