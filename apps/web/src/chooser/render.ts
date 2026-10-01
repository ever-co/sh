/**
 * Pure link rendering for the chooser, with the same rules as `ever-sh-core`'s `render_link`:
 * `{product}` is always filled; `{connect}` is filled with a valid code, and without one its query
 * parameter is dropped (a link never ends in an empty `connect=`); any other placeholder is never
 * guessed (its parameter is dropped; in the path, no link at all).
 *
 * A third-party link that carries Ever's referral code gets `rel="sponsored noopener"`, and the
 * page shows "We may earn a referral fee" next to it; every other third-party link gets
 * `rel="noopener"`.
 */
import type { ProductId } from "~/products";

import { type HostingTarget, statusFor } from "./model";

export interface RenderedLink {
  readonly href: string;
  readonly rel: "" | "noopener" | "sponsored noopener";
  readonly external: boolean;
  /** True when the link carries Ever's referral code at the host. */
  readonly referral: boolean;
}

const PLACEHOLDER = /[{}]/;

function fill(
  template: string,
  product: ProductId,
  connect: string | undefined,
): string | undefined {
  const [rest = "", fragment] = splitOnce(template, "#");
  const [rawBase = "", query] = splitOnce(rest, "?");
  const base = rawBase.replaceAll("{product}", product);
  if (PLACEHOLDER.test(base)) return undefined;
  const pairs = (query ?? "")
    .split("&")
    .filter((pair) => pair !== "")
    .flatMap((raw) => {
      let pair = raw.replaceAll("{product}", product);
      if (pair.includes("{connect}")) {
        if (!connect) return [];
        pair = pair.replaceAll("{connect}", connect);
      }
      return PLACEHOLDER.test(pair) ? [] : [pair];
    });
  return `${base}${pairs.length > 0 ? `?${pairs.join("&")}` : ""}${fragment !== undefined ? `#${fragment}` : ""}`;
}

function splitOnce(s: string, sep: string): [string, string | undefined] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, undefined] : [s.slice(0, i), s.slice(i + 1)];
}

/**
 * The link of `target` for `product`, or undefined when the target does not list the product,
 * the product is "soon" there, or there is nothing to link. `connect` must already be a
 * validated code (`normalizeConnectCode`).
 */
export function renderLink(
  target: HostingTarget,
  product: ProductId,
  connect?: string,
): RenderedLink | undefined {
  const status = statusFor(target, product);
  if (status === undefined || status === "soon") return undefined;
  const offer = target.products.find((p) => p.id === product);
  const template = offer?.link ?? target.link_template;
  if (!template) return undefined;
  const href = fill(template, product, connect);
  if (href === undefined) return undefined;
  const external = target.kind === "third_party";
  const referral = external && target.referral !== null;
  return {
    href,
    rel: external ? (referral ? "sponsored noopener" : "noopener") : "",
    external,
    referral,
  };
}

/** A guide link (`docs_url`) for `product`, or undefined. */
export function docsLink(target: HostingTarget, product: ProductId): string | undefined {
  return target.docs_url ? fill(target.docs_url, product, undefined) : undefined;
}
