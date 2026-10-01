/**
 * Head links of a page that answers 200: its canonical URL (built only from `EVER_SH_URL`, never
 * from the request, never with a query string) and, for a compiled content page, its plain
 * Markdown twin (`/gauzy/docker.md`).
 */
import { Link } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { Show } from "solid-js";

import { origins } from "~/server/origin";

export function HeadLinks(props: { path: string; markdown?: boolean }) {
  const o = createAsync(() => origins(), { deferStream: true });
  return (
    <Show when={o()}>
      {(v) => (
        <>
          <Link rel="canonical" href={`${v().site}${props.path}`} />
          <Show when={props.markdown}>
            <Link rel="alternate" type="text/markdown" href={`${props.path}.md`} />
          </Show>
        </>
      )}
    </Show>
  );
}
