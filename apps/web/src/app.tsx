/**
 * ever.sh shell: header, page, footer, with file routes. Every page is public; there is no
 * signed-in surface, no cookie and no client state. Navigation is plain anchors (`explicitLinks`:
 * the router never intercepts them), so runtime-free pages work with JavaScript switched off.
 */
import "./app.css";

import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, For, Suspense } from "solid-js";

import { PRODUCTS } from "./products";

function Header() {
  return (
    <header class="border-b border-border">
      <div class="mx-auto flex max-w-page flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4">
        <a href="/" class="brand-text text-xl font-bold no-underline">
          ever.sh
        </a>
        <nav aria-label="Site" class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href="/#products" class="no-underline hover:underline">
            Products
          </a>
          <a href="/hosting" class="no-underline hover:underline">
            Where to host
          </a>
          <a href="/platform/connect" class="no-underline hover:underline">
            Ever Connect
          </a>
          <a href="/platform/stats-module" class="no-underline hover:underline">
            Usage statistics
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer class="mt-20 border-t border-border">
      <div class="muted mx-auto grid max-w-page gap-8 px-5 py-10 text-sm sm:grid-cols-3">
        <div>
          <p class="font-semibold text-foreground">Products</p>
          <ul class="mt-2 space-y-1">
            <For each={PRODUCTS}>
              {(p) => (
                <li>
                  <a href={p.site}>{p.name}</a>
                </li>
              )}
            </For>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-foreground">This site</p>
          <ul class="mt-2 space-y-1">
            <li>
              <a href="/platform/connect">Ever Connect</a>
            </li>
            <li>
              <a href="/platform/stats-module">Anonymous usage statistics</a>
            </li>
            <li>
              <a href="/platform/subscription">Free and paid</a>
            </li>
            <li>
              <a href="https://github.com/ever-co/sh">Source on GitHub</a>
            </li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-foreground">Ever</p>
          <ul class="mt-2 space-y-1">
            <li>
              <a href="https://ever.co">ever.co</a>
            </li>
            <li>
              <a href="https://github.com/ever-co">github.com/ever-co</a>
            </li>
            <li>
              Security reports: <a href="mailto:security@ever.co">security@ever.co</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <Router
      explicitLinks
      root={(props) => (
        <MetaProvider>
          <Title>ever.sh · Run Ever products on your own infrastructure</Title>
          <a
            href="#main"
            class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" class="mx-auto max-w-page px-5 py-10">
            <ErrorBoundary fallback={<p>Something went wrong while rendering this page.</p>}>
              <Suspense>{props.children}</Suspense>
            </ErrorBoundary>
          </main>
          <Footer />
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
