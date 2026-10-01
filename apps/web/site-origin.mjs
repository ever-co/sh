/**
 * The one public origin this deployment answers on, and the only place an origin is decided.
 *
 * `EVER_SH_URL` is the public origin of the deployment (the production site, or its dev and stage
 * hosts). Every canonical link, sitemap entry, `robots.txt` line and `return_to` URL is built from
 * it; `tools/check-canonical-origin.mjs` fails the build on a hard-coded site origin anywhere else.
 * `EVER_APP_URL` is the Ever account portal, where connect codes are created (never on this site).
 * `EVER_SH_INDEXABLE=true` lets search engines index the deployment; anything else answers
 * `noindex` everywhere, so a dev or stage host never ends up in a search index.
 *
 * Plain JavaScript because `serve.mjs` (no build step) imports it at runtime; the app imports the
 * same module on the server, so there is one implementation. A malformed value throws at import
 * time: the process refuses to start rather than serving with a guess.
 */

const DEFAULTS = {
  EVER_SH_URL: "http://127.0.0.1:3000",
  EVER_APP_URL: "https://app.ever.co",
};

/**
 * Validates an origin: absolute http(s), no credentials, no path beyond `/`, no query, no fragment.
 * @param {string} name the variable name, for the error message
 * @param {string} raw the value
 * @returns {string} the origin, without a trailing slash
 */
export function validateOrigin(name, raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name}: not an absolute URL: ${JSON.stringify(raw)}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name}: must be http(s)`);
  }
  if (url.username || url.password) throw new Error(`${name}: must not carry credentials`);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name}: must be an origin (no path, query or fragment)`);
  }
  return url.origin;
}

/**
 * Reads the site configuration from an environment.
 * @param {Record<string, string | undefined>} env
 * @returns {{ site: string, app: string, indexable: boolean }}
 */
export function readSiteConfig(env) {
  const indexable = env.EVER_SH_INDEXABLE;
  if (indexable !== undefined && indexable !== "true" && indexable !== "false") {
    throw new Error(
      `EVER_SH_INDEXABLE: must be "true" or "false", got ${JSON.stringify(indexable)}`,
    );
  }
  return {
    site: validateOrigin("EVER_SH_URL", env.EVER_SH_URL ?? DEFAULTS.EVER_SH_URL),
    app: validateOrigin("EVER_APP_URL", env.EVER_APP_URL ?? DEFAULTS.EVER_APP_URL),
    indexable: indexable === "true",
  };
}

const config = readSiteConfig(process.env);

/** The validated public origin of this deployment. */
export const SITE_ORIGIN = config.site;
/** The validated origin of the Ever account portal. */
export const APP_ORIGIN = config.app;
/** Whether search engines may index this deployment. */
export const INDEXABLE = config.indexable;
