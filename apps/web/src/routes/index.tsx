/** `/`: "Run Ever yourself", the products, the way to the hosting chooser. Runtime-free. */
import { Meta, Title } from "@solidjs/meta";
import { For, Show } from "solid-js";

import { HeadLinks } from "~/components/Seo";
import { PRODUCTS } from "~/products";

const EXPLAINERS = [
  {
    href: "/platform/connect",
    title: "Ever Connect",
    text: "Link an install to your Ever organization when you want to. Off until you turn it on.",
  },
  {
    href: "/platform/stats-module",
    title: "Anonymous usage statistics",
    text: "Exactly what is sent, what never is, and the one line that turns it off.",
  },
  {
    href: "/platform/subscription",
    title: "Free and paid",
    text: "Self-hosting is free; the code is never locked behind a subscription.",
  },
];

export default function Home() {
  return (
    <>
      <Title>ever.sh · Run Ever products on your own infrastructure</Title>
      <Meta
        name="description"
        content="Self-host Ever Gauzy, Ever Teams, Ever Works, Ever Rec and Ever Traduora: guides, install settings and hosting options."
      />
      <HeadLinks path="/" />
      <section class="max-w-3xl py-6">
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
          Run <span class="brand-text">Ever</span> yourself
        </h1>
        <p class="muted mt-4 text-lg">
          Install any Ever product on your own servers, connect it to your Ever account when you
          want to, and keep full control.
        </p>
        <p class="mt-6 flex flex-wrap gap-3">
          <a class="button" href="/hosting">
            Compare hosting options
          </a>
          <a class="button-outline" href="#products">
            Browse the products
          </a>
        </p>
      </section>

      <section id="products" class="mt-12" aria-labelledby="products-heading">
        <h2 id="products-heading" class="text-2xl font-semibold tracking-tight">
          Products
        </h2>
        <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <For each={PRODUCTS}>
            {(p) => (
              <li class="card flex flex-col">
                <h3 class="text-lg font-semibold">
                  <a href={`/${p.id}`} class="no-underline hover:underline">
                    {p.name}
                  </a>
                  <Show when={p.status === "soon"}>
                    <span class="badge ml-2 align-middle">Soon</span>
                  </Show>
                </h3>
                <p class="muted mt-2 flex-1 text-sm">{p.tagline}</p>
                <p class="mt-4 flex gap-4 text-sm">
                  <Show
                    when={p.status === "available"}
                    fallback={<a href={p.site}>{p.site.replace("https://", "")}</a>}
                  >
                    <a href={`/${p.id}`}>Guide</a>
                    <a href={`/install/${p.id}`}>Install settings</a>
                    <a href={`/hosting?product=${p.id}`}>Where to host</a>
                  </Show>
                </p>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="mt-16" aria-labelledby="platform-heading">
        <h2 id="platform-heading" class="text-2xl font-semibold tracking-tight">
          What connects, and what never leaves your server
        </h2>
        <ul class="mt-6 grid gap-4 md:grid-cols-3">
          <For each={EXPLAINERS}>
            {(e) => (
              <li class="card">
                <h3 class="font-semibold">
                  <a href={e.href}>{e.title}</a>
                </h3>
                <p class="muted mt-2 text-sm">{e.text}</p>
              </li>
            )}
          </For>
        </ul>
        <p class="muted mt-6 max-w-3xl text-sm">
          Installs set up with the settings from this site report{" "}
          <code>install_source = ever.sh</code> in their anonymous usage statistics, and nothing
          else leaves them until you connect them.
        </p>
      </section>
    </>
  );
}
