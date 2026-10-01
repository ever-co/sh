/**
 * The six Ever products this site documents, and nothing else. Ever Demand is listed as "soon":
 * its index page only, no install page, no settings, no hosting link.
 */
export type ProductId = "gauzy" | "teams" | "works" | "rec" | "traduora" | "demand";

export interface Product {
  readonly id: ProductId;
  readonly name: string;
  /** One line for the product card. */
  readonly tagline: string;
  /** The product's own site. */
  readonly site: string;
  readonly repo: string;
  readonly status: "available" | "soon";
}

export const PRODUCTS: readonly Product[] = [
  {
    id: "gauzy",
    name: "Ever Gauzy",
    tagline: "Business management: time tracking, HR, CRM, invoicing and more.",
    site: "https://gauzy.co",
    repo: "https://github.com/ever-co/ever-gauzy",
    status: "available",
  },
  {
    id: "teams",
    name: "Ever Teams",
    tagline: "Work and project management, on top of the Ever Gauzy API.",
    site: "https://ever.team",
    repo: "https://github.com/ever-co/ever-teams",
    status: "available",
  },
  {
    id: "works",
    name: "Ever Works",
    tagline: "AI agents that research, write, code and deploy, with everything kept in Git.",
    site: "https://ever.works",
    repo: "https://github.com/ever-works/ever-works",
    status: "available",
  },
  {
    id: "rec",
    name: "Ever Rec",
    tagline: "Screen recording and sharing.",
    site: "https://rec.so",
    repo: "https://github.com/ever-co/ever-rec",
    status: "available",
  },
  {
    id: "traduora",
    name: "Ever Traduora",
    tagline: "Translation management for teams.",
    site: "https://traduora.co",
    repo: "https://github.com/ever-co/ever-traduora",
    status: "available",
  },
  {
    id: "demand",
    name: "Ever Demand",
    tagline: "Commerce platform for on-demand businesses and marketplaces.",
    site: "https://everdemand.co",
    repo: "https://github.com/ever-co/ever-demand",
    status: "soon",
  },
];

export function productById(id: string | undefined): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Products with an install page (every product except the "soon" ones). */
export function installable(id: string | undefined): Product | undefined {
  const product = productById(id);
  return product?.status === "available" ? product : undefined;
}
