/**
 * Unit tests of the site's pure modules (chooser, install settings, server read, HTTP policy).
 * No framework plugin: the tested modules are plain TypeScript and JavaScript.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
