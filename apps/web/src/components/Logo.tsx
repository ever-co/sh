/**
 * Logos and the two neutral icons, all static markup: a logo is an `<img>` of its SVG file, an
 * icon is inline SVG in the text colour. Nothing here needs JavaScript in the browser.
 */
import { Show } from "solid-js";

import type { Logo as LogoFile } from "~/logos";

/**
 * A logo, `height` pixels tall (or `unit` pixels per unit of the file's viewBox, which keeps the
 * ever® part of every Ever lockup the same size); the width follows the logo's proportions. `alt`
 * defaults to the brand's name; pass "" where the same name is already written next to it.
 */
export function Logo(props: {
  logo: LogoFile;
  height?: number;
  unit?: number;
  alt?: string;
  class?: string;
}) {
  const height = () => props.height ?? props.logo.height * (props.unit ?? 1);
  const width = () => (props.logo.width / props.logo.height) * height();
  return (
    <img
      src={props.logo.src}
      alt={props.alt ?? props.logo.alt}
      width={Math.round(width())}
      height={Math.round(height())}
      decoding="async"
      class={["logo", props.logo.reverseOnDark ? "logo-reverse-dark" : "", props.class ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/**
 * A neutral icon where there is no brand logo: a server (running it yourself), a cloud (a host
 * without a logo) or a file (the environment file of an install page).
 */
export function NeutralIcon(props: { kind: "server" | "cloud" | "file"; size?: number }) {
  const size = () => props.size ?? 24;
  return (
    <svg
      class="neutral-icon"
      viewBox="0 0 24 24"
      width={size()}
      height={size()}
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <Show when={props.kind === "server"}>
        <rect x="3.5" y="4" width="17" height="6.5" rx="1.75" />
        <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.75" />
        <path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h5.5M11 16.75h5.5" />
      </Show>
      <Show when={props.kind === "cloud"}>
        <path d="M7.25 18.5a4.25 4.25 0 0 1-.6-8.46 5.5 5.5 0 0 1 10.6-1.3 4.9 4.9 0 0 1-.5 9.76z" />
      </Show>
      <Show when={props.kind === "file"}>
        <path d="M13.5 3.5H7.25a1.75 1.75 0 0 0-1.75 1.75v13.5c0 .97.78 1.75 1.75 1.75h9.5c.97 0 1.75-.78 1.75-1.75V8.5z" />
        <path d="M13.5 3.5v5h5M9 13h6M9 16.5h4" />
      </Show>
    </svg>
  );
}
