/**
 * Connect-code links. This site NEVER creates a connect code and never calls a write endpoint.
 *
 * The only sequence it supports:
 *   1. `/install/<product>` offers "Connect this install to Ever" → `connectStartUrl()`:
 *      `<EVER_APP_URL>/connect/new?product=<p>&return_to=<this page>&source=ever.sh`.
 *   2. The Ever account portal signs the visitor in with Ever ID, lets them pick (or create) the
 *      organization, and creates a single-use code valid for 24 hours.
 *   3. The portal sends the visitor back to `return_to?connect=EVC-XXXX-XXXX-XXXX`.
 *   4. `parseInstallParams()` reads `?connect=` and the page writes it into the settings
 *      (`EVER_CONNECT_ENABLED=true`, `EVER_CONNECT_CODE`).
 *   5. At its first start the product redeems the code itself; a second use is refused.
 *
 * Input hygiene: `connect` comes from the URL, so it is visitor-controlled. It is accepted ONLY
 * when it matches the exact grammar; anything else is dropped: never echoed into a snippet, a
 * link or the page.
 */

/** `EVC-` + three groups of four Crockford base32 characters (no I, L, O, U); case-insensitive. */
const CONNECT_CODE = /^EVC(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

export interface InstallParams {
  /** The normalized (upper-case) code, when one was given and is valid. */
  readonly connect?: string;
  /** True when a `connect` value was given but is not a code (the page says so, once). */
  readonly rejectedConnect: boolean;
}

export function normalizeConnectCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const code = raw.trim().toUpperCase();
  return CONNECT_CODE.test(code) ? code : undefined;
}

export function parseInstallParams(search: URLSearchParams): InstallParams {
  const raw = search.get("connect");
  const supplied = raw !== null && raw.trim() !== "";
  const connect = supplied ? normalizeConnectCode(raw) : undefined;
  return connect ? { connect, rejectedConnect: false } : { rejectedConnect: supplied };
}

/**
 * The portal URL that starts the "connect this install" flow. Both origins come from
 * `site-origin.mjs` (validated at start-up); `product` must already be a known product id.
 */
export function connectStartUrl(appOrigin: string, siteOrigin: string, product: string): string {
  const returnTo = new URL(`/install/${encodeURIComponent(product)}`, siteOrigin).toString();
  const url = new URL("/connect/new", appOrigin);
  url.searchParams.set("product", product);
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("source", "ever.sh");
  return url.toString();
}
