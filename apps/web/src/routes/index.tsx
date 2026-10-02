/**
 * `/`: "Run Ever yourself", the products, where they run, the way to the hosting chooser.
 * Runtime-free.
 */
import { Meta, Title } from "@solidjs/meta";
import { For, Show } from "solid-js";

import { type HostingTarget, parseTargets, statusFor } from "~/chooser/model";
import { Logo, NeutralIcon } from "~/components/Logo";
import { HeadLinks } from "~/components/Seo";
import snapshot from "~/content.generated/hosts.json";
import { hostLogo, PRODUCT_LOGOS } from "~/logos";
import { PRODUCTS, type ProductId } from "~/products";

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

/**
 * Where the products run, from the hosting list built into the site (the home page reads nothing
 * over the network; the chooser at `/hosting` shows the live list). Each entry opens the chooser on
 * the first product it offers.
 */
const KIND_ORDER: Record<HostingTarget["kind"], number> = {
  self_host: 0,
  ever_cloud: 1,
  third_party: 2,
};
const HOSTS = parseTargets(snapshot.targets)
  .map((target) => ({
    target,
    product: PRODUCTS.map((p) => p.id).find((id: ProductId) => {
      const status = statusFor(target, id);
      return status === "available" || status === "beta";
    }),
  }))
  .filter((h) => h.product !== undefined)
  .sort(
    (a, b) =>
      KIND_ORDER[a.target.kind] - KIND_ORDER[b.target.kind] ||
      a.target.order - b.target.order ||
      a.target.id.localeCompare(b.target.id),
  );

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
                {/* The product's own lockup is its name here (its text alternative). */}
                <h3 class="flex min-h-7 items-center gap-2">
                  <a href={`/${p.id}`} class="inline-flex no-underline">
                    <Logo logo={PRODUCT_LOGOS[p.id]} unit={1.25} />
                  </a>
                  <Show when={p.status === "soon"}>
                    <span class="badge">Soon</span>
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

      <section class="mt-16" aria-labelledby="hosts-heading">
        <h2 id="hosts-heading" class="text-2xl font-semibold tracking-tight">
          Where they run
        </h2>
        <p class="muted mt-2 max-w-3xl">
          On your own server or cluster, on Ever Cloud, or with a third-party host.
        </p>
        <ul class="mt-6 flex flex-wrap gap-3">
          <For each={HOSTS}>
            {(h) => (
              <li>
                <a
                  href={`/hosting?product=${h.product}`}
                  class="inline-flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm font-medium no-underline hover:bg-accent"
                >
                  {/* The host's name is written next to its logo: the image adds no text. */}
                  <Show
                    when={hostLogo(h.target.id)}
                    fallback={
                      <NeutralIcon kind={h.target.kind === "self_host" ? "server" : "cloud"} />
                    }
                  >
                    {(logo) => <Logo logo={logo()} height={24} alt="" />}
                  </Show>
                  {h.target.title}
                </a>
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
