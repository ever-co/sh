/**
 * `/hosting[?product=<id>]`: THE CHOOSER, in three columns: "Run it yourself", "Ever Cloud",
 * "Third-party hosts". The list comes from this repository's API service (server-side, no
 * credential), with the copy built into the site as the last resort; a saved list is labelled
 * with its date. A link that carries Ever's referral code is marked `sponsored` and has the note
 * "We may earn a referral fee" next to it.
 *
 * The one page that hydrates: the product switch filters the same list without a reload (and
 * the switch is a plain link without JavaScript).
 */
import { Meta, Title } from "@solidjs/meta";
import { createAsync, useSearchParams } from "@solidjs/router";
import { For, Show } from "solid-js";

import { columnsFor, type HostingTarget, statusFor } from "~/chooser/model";
import { docsLink, type RenderedLink, renderLink } from "~/chooser/render";
import { Logo, NeutralIcon } from "~/components/Logo";
import { HeadLinks } from "~/components/Seo";
import { pageAt } from "~/content";
import { hostLogo, PRODUCT_LOGOS } from "~/logos";
import { installable, PRODUCTS, type ProductId, productById } from "~/products";

async function hostingTargets() {
  "use server";
  const { loadTargets } = await import("~/server/targets");
  return loadTargets();
}

/**
 * Links the list makes into THIS site (its production, dev or stage host) become relative, so
 * every deployment stays on its own host. This rewrites data; it emits no origin.
 */
const SELF = /^https:\/\/(?:dev\.|stage\.)?ever\.sh(\/[^?#]*)?(\?[^#]*)?$/; // canonical-origin: allow

/** A same-site path this deployment actually serves (no link to a page not written yet). */
function servedHere(path: string): boolean {
  if (path === "/hosting") return true;
  const install = /^\/install\/([a-z]+)$/.exec(path);
  if (install) return installable(install[1]) !== undefined && pageAt(path) !== undefined;
  return pageAt(path) !== undefined;
}

/** The href to render, or undefined when it points at a page of this site that does not exist. */
function localize(href: string): string | undefined {
  const m = SELF.exec(href);
  if (!m) return href;
  const path = m[1] || "/";
  return servedHere(path) ? `${path}${m[2] ?? ""}` : undefined;
}

function actionLabel(target: HostingTarget, href: string): string {
  if (target.kind === "third_party") return `Deploy on ${target.title}`;
  if (target.kind === "ever_cloud") return "Start on Ever Cloud";
  return href.startsWith("/install/") ? "Get the install settings" : "Read the guide";
}

function Card(props: { target: HostingTarget; product: ProductId }) {
  const status = () => statusFor(props.target, props.product);
  const link = (): (RenderedLink & { href: string }) | undefined => {
    const l = renderLink(props.target, props.product);
    const href = l && localize(l.href);
    return l && href ? { ...l, href } : undefined;
  };
  const guide = () => {
    const d = docsLink(props.target, props.product);
    const href = d && localize(d);
    return href && href !== link()?.href ? href : undefined;
  };
  return (
    <li class="card">
      <div class="flex items-center gap-3">
        {/* The host's logo (a neutral icon when the hosting list names a host without one). */}
        <Show
          when={hostLogo(props.target.id)}
          fallback={<NeutralIcon kind={props.target.kind === "self_host" ? "server" : "cloud"} />}
        >
          {(logo) => <Logo logo={logo()} height={24} />}
        </Show>
        <h3 class="flex-1 font-semibold">{props.target.title}</h3>
        <Show when={status() !== "available"}>
          <span class="badge">{status() === "beta" ? "Beta" : "Soon"}</span>
        </Show>
      </div>
      <p class="muted mt-2 text-sm">{props.target.summary_md}</p>
      <Show when={props.target.requirements_md}>
        {(r) => <p class="muted mt-1 text-sm">{r()}</p>}
      </Show>
      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Show when={link()}>
          {(l) => (
            <span class="inline-flex flex-wrap items-center gap-x-2">
              <a
                href={l().href}
                rel={l().rel || undefined}
                target={l().external ? "_blank" : undefined}
                class="font-medium"
              >
                {actionLabel(props.target, l().href)}
              </a>
              {/* Ever's referral code is in this link: say so next to it. */}
              <Show when={l().referral}>
                <span class="referral-note">We may earn a referral fee</span>
              </Show>
            </span>
          )}
        </Show>
        <Show when={guide()}>{(g) => <a href={g()}>Guide</a>}</Show>
      </div>
    </li>
  );
}

export default function Hosting() {
  const [search, setSearch] = useSearchParams<{ product?: string }>();
  const product = (): ProductId => {
    const raw = search.product;
    return productById(typeof raw === "string" ? raw : undefined)?.id ?? "gauzy";
  };
  const data = createAsync(() => hostingTargets(), { deferStream: true });
  const intro = pageAt("/hosting");

  return (
    <>
      <Title>Where to host · ever.sh</Title>
      <Meta
        name="description"
        content="Compare running Ever products yourself, on Ever Cloud, or with a third-party host."
      />
      <HeadLinks path="/hosting" markdown />
      <h1 class="text-3xl font-bold tracking-tight">
        Where to host {productById(product())?.name}
      </h1>
      <Show when={intro}>
        {(p) => (
          <div class="prose muted mt-4">
            {/* Trusted: HTML compiled at build time from reviewed Markdown, raw HTML disabled. */}
            <div innerHTML={p().html} />
          </div>
        )}
      </Show>

      <nav aria-label="Product" class="mt-8">
        <ul class="flex flex-wrap gap-2">
          <For each={PRODUCTS}>
            {(p) => (
              <li>
                <a
                  href={`/hosting?product=${p.id}`}
                  aria-current={p.id === product() ? "page" : undefined}
                  class="button-outline h-10 aria-[current=page]:border-foreground/40 aria-[current=page]:bg-accent"
                  onClick={(e) => {
                    e.preventDefault();
                    setSearch({ product: p.id });
                  }}
                >
                  {/* The product's lockup is the link's name (its text alternative). */}
                  <Logo logo={PRODUCT_LOGOS[p.id]} unit={1} />
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>

      <Show when={data()}>
        {(d) => (
          <>
            <Show when={d().source === "snapshot"}>
              <p class="muted mt-6 text-sm">List as of {d().asOf}.</p>
            </Show>
            <div class="mt-6 grid gap-6 lg:grid-cols-3">
              <For each={columnsFor(d().targets, product())}>
                {(column) => (
                  <section aria-labelledby={`col-${column.kind}`}>
                    <h2 id={`col-${column.kind}`} class="text-lg font-semibold">
                      {column.heading}
                    </h2>
                    <ul class="mt-3 space-y-3">
                      <For each={column.targets}>
                        {(t) => <Card target={t} product={product()} />}
                      </For>
                    </ul>
                  </section>
                )}
              </For>
            </div>
            <p class="muted mt-8 text-sm">
              Third-party hosts are independent companies; Ever does not operate them.
            </p>
          </>
        )}
      </Show>
    </>
  );
}
