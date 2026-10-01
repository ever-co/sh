/**
 * `/<product>` and `/<product>/<page>`: compiled Markdown from `content/products`. A path with no
 * compiled page answers a REAL 404 with `noindex` (never a soft 200). Runtime-free.
 */
import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { NotFound } from "~/components/NotFound";
import { ProductNav } from "~/components/ProductNav";
import { HeadLinks } from "~/components/Seo";
import { Sources } from "~/components/Sources";
import { pageAt } from "~/content";
import { installable, productById } from "~/products";

export default function ProductPage() {
  const params = useParams<{ product: string; slug?: string }>();
  const product = () => productById(params.product);
  const route = () => `/${params.product}${params.slug ? `/${params.slug}` : ""}`;
  const page = () => {
    const p = product() ? pageAt(route()) : undefined;
    return p?.kind === "product" ? p : undefined;
  };
  return (
    <Show when={product() && page()} fallback={<NotFound />}>
      <Title>{`${page()?.title} · ever.sh`}</Title>
      <Meta name="description" content={page()?.description ?? ""} />
      <HeadLinks path={route()} markdown />
      <Show when={product()}>{(p) => <ProductNav product={p()} current={route()} />}</Show>
      <article class="prose">
        <h1 class="text-3xl font-bold tracking-tight">
          {page()?.title}
          <Show when={page()?.status === "soon"}>
            <span class="badge ml-3 align-middle">Soon</span>
          </Show>
        </h1>
        {/* Trusted: HTML compiled at build time from reviewed Markdown, raw HTML disabled. */}
        <div innerHTML={page()?.html ?? ""} />
      </article>
      <Show when={installable(params.product)}>
        <p class="mt-8 flex flex-wrap gap-3">
          <a class="button" href={`/install/${params.product}`}>
            Get the install settings
          </a>
          <a class="button-outline" href={`/hosting?product=${params.product}`}>
            Where to host
          </a>
        </p>
      </Show>
      <Show when={page()?.sources}>
        {(sources) => <Sources sources={sources()} verified={page()?.verified} />}
      </Show>
    </Show>
  );
}
