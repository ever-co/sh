/**
 * A product's breadcrumbs and sub-navigation: its guide pages (only those that exist; a missing
 * content file simply has no tab) and, for installable products, the install page.
 */
import { For, Show } from "solid-js";

import { productTabs } from "~/content";
import { installable, type Product } from "~/products";

export function ProductNav(props: { product: Product; current: string; currentLabel?: string }) {
  const tabs = () => productTabs(props.product.id);
  const install = () =>
    installable(props.product.id) ? `/install/${props.product.id}` : undefined;
  const crumb = () =>
    props.currentLabel ??
    tabs().find((t) => t.href === props.current && t.label !== "Overview")?.label;
  return (
    <div class="mb-8 space-y-3">
      <nav aria-label="Breadcrumb" class="muted text-sm">
        <a href="/">ever.sh</a>
        <span aria-hidden="true"> › </span>
        <Show when={crumb()} fallback={<span aria-current="page">{props.product.name}</span>}>
          {(label) => (
            <>
              <a href={`/${props.product.id}`}>{props.product.name}</a>
              <span aria-hidden="true"> › </span>
              <span aria-current="page">{label()}</span>
            </>
          )}
        </Show>
      </nav>
      <nav aria-label={`${props.product.name} pages`}>
        <ul class="flex flex-wrap gap-2 border-b border-border pb-3 text-sm">
          <For each={tabs()}>
            {(tab) => (
              <li>
                <a
                  href={tab.href}
                  aria-current={tab.href === props.current ? "page" : undefined}
                  class="rounded-md px-3 py-1.5 no-underline hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
                >
                  {tab.label}
                </a>
              </li>
            )}
          </For>
          <Show when={install()}>
            {(href) => (
              <li>
                <a
                  href={href()}
                  aria-current={href() === props.current ? "page" : undefined}
                  class="rounded-md px-3 py-1.5 no-underline hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
                >
                  Install settings
                </a>
              </li>
            )}
          </Show>
        </ul>
      </nav>
    </div>
  );
}
