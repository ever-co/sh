/**
 * The compiled content (`tools/build-content.mjs`). Pages are keyed by route: `/gauzy`,
 * `/gauzy/docker`, `/install/gauzy`, `/platform/connect`, `/hosting`.
 */
import pages from "~/content.generated/pages.json";

import type { ProductId } from "~/products";

export interface Source {
  readonly repo: string;
  readonly path: string;
  readonly sha: string;
}

export interface Page {
  readonly kind: "product" | "install" | "platform" | "hosting";
  readonly product?: ProductId;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly order: number;
  readonly status: "available" | "beta" | "soon";
  readonly sources?: readonly Source[];
  readonly verified?: string;
  readonly snippets?: readonly ("compose" | "env" | "helm")[];
  /** Trusted: produced at build time from reviewed Markdown with raw HTML disabled. */
  readonly html: string;
}

const PAGES = pages as unknown as Record<string, Page>;

/** The page at a route (a trailing slash is ignored). */
export function pageAt(route: string): Page | undefined {
  return PAGES[route.replace(/\/+$/, "") || "/"];
}

/** Every compiled route, sorted. */
export function allRoutes(): string[] {
  return Object.keys(PAGES).sort();
}

export interface ProductTab {
  readonly href: string;
  readonly label: string;
}

/** The product's guide pages in their front-matter order: the tabs of its sub-navigation. */
export function productTabs(product: ProductId): ProductTab[] {
  return Object.entries(PAGES)
    .filter(([, page]) => page.kind === "product" && page.product === product)
    .sort(([, a], [, b]) => a.order - b.order || a.slug.localeCompare(b.slug))
    .map(([href, page]) => ({ href, label: page.slug === "index" ? "Overview" : tabLabel(page) }));
}

function tabLabel(page: Page): string {
  const labels: Record<string, string> = {
    docker: "Docker",
    kubernetes: "Kubernetes",
    "bare-metal": "Bare metal",
    requirements: "Requirements",
    upgrade: "Upgrade",
    security: "Security",
  };
  return labels[page.slug] ?? page.title;
}

/** A source's link on GitHub, pinned to the commit the page was checked against. */
export function sourceUrl(source: Source): string {
  const [path, anchor] = source.path.split("#", 2);
  return `https://github.com/${source.repo}/blob/${source.sha}/${path}${anchor ? `#${anchor}` : ""}`;
}
