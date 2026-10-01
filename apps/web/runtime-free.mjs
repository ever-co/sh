/**
 * Which pages ship the framework runtime. Everything on ever.sh renders completely on the server
 * and owns no control the framework would operate, so every page is runtime-free (plain HTML and
 * CSS that work with JavaScript switched off) EXCEPT the hosting chooser, which switches products
 * without a reload.
 *
 * Used twice, so it is plain JavaScript: `src/entry-server.tsx` leaves the entry script out of a
 * runtime-free page, and `serve.mjs` removes what the renderer still adds for hydration (the
 * module preloads and the inline bootstrap and data scripts), so the browser downloads no
 * JavaScript for these pages at all.
 *
 * An unknown path hydrates: a page that silently lost interactivity is worse than a page that
 * shipped bytes it did not need.
 */
const RUNTIME_FREE = [
  { pattern: /^\/$/, why: "home: prose, product cards, links" },
  {
    pattern: /^\/(gauzy|teams|works|rec|traduora|demand)(\/[a-z0-9-]+)?$/,
    why: "product guides: compiled Markdown",
  },
  { pattern: /^\/platform\/[a-z0-9-]+$/, why: "explainers: compiled Markdown" },
  { pattern: /^\/install\/[a-z]+$/, why: "install page: server-rendered settings, plain links" },
];

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isRuntimeFree(pathname) {
  return RUNTIME_FREE.some((r) => r.pattern.test(pathname));
}

/**
 * Removes every script and module preload from a rendered page (stylesheets stay).
 * @param {string} html
 * @returns {string}
 */
export function stripRuntime(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, "");
}
