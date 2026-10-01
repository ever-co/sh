/** The "Sources" box: the product documents a page condenses, pinned to the checked commit. */
import { For } from "solid-js";

import { type Source, sourceUrl } from "~/content";

export function Sources(props: { sources: readonly Source[]; verified?: string | undefined }) {
  return (
    <aside class="card mt-10 max-w-3xl text-sm" aria-label="Sources">
      <h2 class="font-semibold">Sources</h2>
      <ul class="mt-2 space-y-1">
        <For each={props.sources}>
          {(s) => (
            <li>
              <a href={sourceUrl(s)} rel="noopener">
                {s.repo}/{s.path}
              </a>{" "}
              <span class="muted font-mono text-xs">@{s.sha.slice(0, 7)}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="muted mt-2">
        {props.verified ? `Checked against these commits on ${props.verified}. ` : ""}The product's
        own documentation is the reference when it differs.
      </p>
    </aside>
  );
}
