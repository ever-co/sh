/**
 * `/install/<product>[?connect=EVC-…]`: the install page. Server-rendered, runtime-free.
 *
 * - Without `?connect=`: settings with `EVER_INSTALL_SOURCE=ever.sh` and statistics on; the
 *   connection stays off, and "Connect this install to Ever" starts the portal flow (this site
 *   never creates a code).
 * - With a valid code: the same settings with `EVER_CONNECT_ENABLED=true` and the code filled in.
 * - With a malformed code: it is left out and the page says so, once; the value is never shown.
 *
 * A page with a code is personal: `noindex`, `no-store` and `no-referrer` (set by serve.mjs), and
 * the canonical URL never carries the query.
 */
import { Meta, Title } from "@solidjs/meta";
import { createAsync, useLocation, useParams } from "@solidjs/router";
import { For, Show } from "solid-js";

import { NotFound } from "~/components/NotFound";
import { ProductNav } from "~/components/ProductNav";
import { HeadLinks } from "~/components/Seo";
import { Sources } from "~/components/Sources";
import { pageAt } from "~/content";
import { connectStartUrl, parseInstallParams } from "~/install/connect";
import { SNIPPET_LABELS, snippet } from "~/install/snippets";
import { installable } from "~/products";
import { origins } from "~/server/origin";

export default function InstallPage() {
  const params = useParams<{ product: string }>();
  const location = useLocation();
  const product = () => installable(params.product);
  const route = () => `/install/${params.product}`;
  const page = () => {
    const p = product() ? pageAt(route()) : undefined;
    return p?.kind === "install" ? p : undefined;
  };
  const install = () => parseInstallParams(new URLSearchParams(location.search));
  const o = createAsync(() => origins(), { deferStream: true });
  const blocks = () => {
    const p = product();
    if (!p) return [];
    return (page()?.snippets ?? []).flatMap((kind) => {
      const text = snippet(kind, { product: p.id, connect: install().connect });
      return text ? [{ kind, text, ...SNIPPET_LABELS[kind] }] : [];
    });
  };

  return (
    <Show
      when={product() && page()}
      fallback={<NotFound message="There is no install page for this product." />}
    >
      <Title>{`Install ${product()?.name} · ever.sh`}</Title>
      <Meta name="description" content={page()?.description ?? ""} />
      <HeadLinks path={route()} markdown />
      <Show when={install().connect || install().rejectedConnect}>
        <Meta name="robots" content="noindex" />
      </Show>
      <Show when={product()}>
        {(p) => <ProductNav product={p()} current={route()} currentLabel="Install settings" />}
      </Show>

      <h1 class="text-3xl font-bold tracking-tight">Install {product()?.name}</h1>

      <Show when={install().rejectedConnect}>
        <p role="status" class="notice mt-6 max-w-3xl">
          The connect code in this link is not valid, so it was left out. Create a new one in your
          Ever account.
        </p>
      </Show>
      <Show when={install().connect}>
        <p role="status" class="notice mt-6 max-w-3xl">
          Connect code received: it is written into the settings below. It works once and expires 24
          hours after it was created.
        </p>
      </Show>

      <div class="prose mt-6">
        {/* Trusted: HTML compiled at build time from reviewed Markdown, raw HTML disabled. */}
        <div innerHTML={page()?.html ?? ""} />
      </div>

      <section class="mt-10 max-w-3xl" aria-labelledby="settings-heading">
        <h2 id="settings-heading" class="text-xl font-semibold tracking-tight">
          Settings for your install
        </h2>
        <For each={blocks()}>
          {(b) => (
            <div class="mt-6">
              <h3 class="font-semibold">{b.title}</h3>
              <p class="muted text-sm">{b.file}</p>
              <pre class="snippet mt-2">
                <code>{b.text}</code>
              </pre>
            </div>
          )}
        </For>
      </section>

      <section class="mt-10 max-w-3xl" aria-labelledby="connect-heading">
        <h2 id="connect-heading" class="text-xl font-semibold tracking-tight">
          Connect this install to Ever (optional)
        </h2>
        <Show
          when={install().connect}
          fallback={
            <Show when={o()}>
              {(v) => (
                <p class="mt-3">
                  Want this install listed under your organization in your Ever account?{" "}
                  <a href={connectStartUrl(v().app, v().site, params.product)}>
                    Connect this install to Ever
                  </a>
                  . You sign in with Ever ID, pick your organization and come back here with the
                  settings filled in. The product works fully without it.
                </p>
              )}
            </Show>
          }
        >
          <p class="mt-3">
            These settings connect the install to your Ever organization at its first start.
          </p>
        </Show>
        <h3 class="mt-6 font-semibold">What happens next</h3>
        <ul class="mt-2 list-disc space-y-1 pl-6">
          <li>
            After its first start, a connected install appears under your organization in your Ever
            account.
          </li>
          <li>
            If the code was created in another browser session, an owner of the organization
            approves the install there first.
          </li>
          <li>You can disconnect at any time; the product keeps working.</li>
        </ul>
        <p class="muted mt-6 text-sm">
          Anonymous usage statistics are on by default and contain no personal or business records.{" "}
          <a href="/platform/stats-module">See exactly what is sent and how to turn it off</a>.
        </p>
      </section>

      <Show when={page()?.sources}>
        {(sources) => <Sources sources={sources()} verified={page()?.verified} />}
      </Show>
    </Show>
  );
}
