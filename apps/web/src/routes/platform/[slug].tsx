/** `/platform/<page>`: Ever Connect, the anonymous statistics, free and paid. Runtime-free. */
import { Meta, Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { NotFound } from "~/components/NotFound";
import { HeadLinks } from "~/components/Seo";
import { pageAt } from "~/content";

export default function PlatformPage() {
  const params = useParams<{ slug: string }>();
  const route = () => `/platform/${params.slug}`;
  const page = () => {
    const p = pageAt(route());
    return p?.kind === "platform" ? p : undefined;
  };
  return (
    <Show when={page()} fallback={<NotFound />}>
      {(p) => (
        <>
          <Title>{`${p().title} · ever.sh`}</Title>
          <Meta name="description" content={p().description} />
          <HeadLinks path={route()} markdown />
          <article class="prose">
            <h1 class="text-3xl font-bold tracking-tight">{p().title}</h1>
            {/* Trusted: HTML compiled at build time from reviewed Markdown, raw HTML disabled. */}
            <div innerHTML={p().html} />
          </article>
        </>
      )}
    </Show>
  );
}
