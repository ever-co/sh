/** A real 404: status code, `noindex`, no canonical, and a way back. */
import { Meta, Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { For } from "solid-js";

import { PRODUCTS } from "~/products";

export function NotFound(props: { message?: string }) {
  return (
    <section class="py-10">
      <HttpStatusCode code={404} />
      <Title>Not found · ever.sh</Title>
      <Meta name="robots" content="noindex, nofollow" />
      <h1 class="text-3xl font-bold tracking-tight">Nothing here</h1>
      <p class="muted mt-3">{props.message ?? "This page does not exist."}</p>
      <ul class="mt-6 flex flex-wrap gap-3">
        <For each={PRODUCTS}>
          {(p) => (
            <li>
              <a class="button-outline" href={`/${p.id}`}>
                {p.name}
              </a>
            </li>
          )}
        </For>
        <li>
          <a class="button-outline" href="/hosting">
            Where to host
          </a>
        </li>
      </ul>
    </section>
  );
}
