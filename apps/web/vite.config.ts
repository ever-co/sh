/**
 * ever.sh build configuration.
 *
 * SolidStart 2 is Vite with the `solidStart()` plugin: there is no `app.config.ts` and no Nitro,
 * and the framework configuration lives here. Tailwind 4 is CSS-first (`src/app.css`).
 *
 * There is deliberately no dev proxy: this site never calls an API from the browser. Its only API
 * read happens on the server (`src/server/targets.ts`, which asks this repository's API service),
 * so `EVER_SH_API_URL` never reaches a client bundle.
 */
import { fileURLToPath } from "node:url";

import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const SRC = fileURLToPath(new URL("./src", import.meta.url));

/** Drops the framework's dev-toolbar stylesheets from production bundles (dead weight there). */
const DEV_TOOLBAR_CSS =
  /[\\/]@solidjs[\\/]start[\\/]dist[\\/]shared[\\/](?:dev-toolbar|ui)[\\/].*\.css(?:\?.*)?$/;
const dropDevToolbarCss = (): Plugin => ({
  name: "ever-sh:drop-dev-toolbar-css",
  apply: "build",
  enforce: "pre",
  transform(_code, id) {
    return DEV_TOOLBAR_CSS.test(id) ? { code: "", map: null } : null;
  },
});

export default defineConfig(({ command }) => ({
  plugins: [dropDevToolbarCss(), solidStart({ devOverlay: command !== "build" }), tailwindcss()],
  resolve: { alias: { "~": SRC } },
  // The dev error viewer's source-map helper ships UMD dependencies: pre-bundle them for `vite dev`.
  optimizeDeps: {
    include: ["@solidjs/start > @jridgewell/trace-mapping"],
  },
  server: {
    port: 3000,
    headers: {
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  },
}));
