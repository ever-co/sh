// @refresh reload
/**
 * The document shell. Runtime-free pages (`runtime-free.mjs`) are sent without the framework's
 * entry script; `serve.mjs` also drops the hydration leftovers, so they are plain HTML and CSS.
 */
import { createHandler, StartServer } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";

import { isRuntimeFree } from "../runtime-free.mjs";

/** The path being rendered, or "" (which hydrates: the safe direction) when unknown. */
function currentPath(): string {
  const event = getRequestEvent();
  if (!event) return "";
  try {
    return new URL(event.request.url).pathname;
  } catch {
    return "";
  }
}

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {isRuntimeFree(currentPath()) ? null : scripts}
        </body>
      </html>
    )}
  />
));
