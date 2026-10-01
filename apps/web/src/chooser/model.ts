/**
 * The hosting chooser's data model: what `GET /v1/hosting-targets` returns (this repository's
 * API service answers with the Ever Platform's list, or with its compiled-in snapshot) and what
 * `content/hosting/hosts.yaml` stores (same shape; schema in `content/hosting/hosts.schema.json`).
 * The site never hard-codes a host: a host appears when the list names it.
 */
import type { ProductId } from "~/products";

/** Chooser column. */
export type TargetKind = "ever_cloud" | "self_host" | "third_party";
export type TargetStatus = "available" | "beta" | "soon";
export type SnippetKind = "compose" | "env" | "helm" | "none";

export interface TargetProduct {
  readonly id: ProductId;
  readonly status: TargetStatus;
  /** A link for this product only; otherwise the target's `link_template` applies. */
  readonly link?: string;
}

export interface HostingTarget {
  readonly id: string;
  readonly kind: TargetKind;
  readonly title: string;
  readonly summary_md: string;
  readonly requirements_md?: string;
  readonly docs_url?: string;
  readonly badge?: string;
  readonly products: readonly TargetProduct[];
  /** What an install made this way reports as its source. */
  readonly install_source: string;
  /** `{product}` and `{connect}` placeholders. */
  readonly link_template?: string;
  readonly snippet_kind: SnippetKind;
  /** Ever's referral code at this host, already in its links; `null` otherwise. */
  readonly referral: { readonly program: string; readonly param: string } | null;
  readonly order: number;
  readonly status: TargetStatus;
}

export interface Column {
  readonly kind: TargetKind;
  readonly heading: string;
  readonly targets: readonly HostingTarget[];
}

const HEADINGS: Record<TargetKind, string> = {
  self_host: "Run it yourself",
  ever_cloud: "Ever Cloud",
  third_party: "Third-party hosts",
};
const COLUMN_ORDER: readonly TargetKind[] = ["self_host", "ever_cloud", "third_party"];
const KINDS = new Set<string>(COLUMN_ORDER);
const STATUSES = new Set<string>(["available", "beta", "soon"]);
const PRODUCTS = new Set<string>(["gauzy", "teams", "works", "rec", "traduora", "demand"]);

/** A target's status for `product`, or undefined when it does not list it. Demand is always soon. */
export function statusFor(target: HostingTarget, product: ProductId): TargetStatus | undefined {
  const offer = target.products.find((p) => p.id === product);
  if (!offer) return undefined;
  return product === "demand" ? "soon" : offer.status;
}

/**
 * The targets that list `product`, in the three chooser columns (fixed order, empty columns
 * hidden); within a column, "soon" entries go last, then by `order`, then by id.
 */
export function columnsFor(targets: readonly HostingTarget[], product: ProductId): Column[] {
  const rank = (t: HostingTarget) => (statusFor(t, product) === "soon" ? 1 : 0);
  return COLUMN_ORDER.map((kind) => ({
    kind,
    heading: HEADINGS[kind],
    targets: targets
      .filter((t) => t.kind === kind && statusFor(t, product) !== undefined)
      .sort((a, b) => rank(a) - rank(b) || a.order - b.order || a.id.localeCompare(b.id)),
  })).filter((c) => c.targets.length > 0);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isTargetProduct(v: unknown): v is TargetProduct {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isString(p.id) &&
    PRODUCTS.has(p.id) &&
    isString(p.status) &&
    STATUSES.has(p.status) &&
    (p.link === undefined || (isString(p.link) && p.link.startsWith("https://")))
  );
}

function isTarget(v: unknown): v is HostingTarget {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  const referral = t.referral;
  return (
    isString(t.id) &&
    isString(t.kind) &&
    KINDS.has(t.kind) &&
    isString(t.title) &&
    isString(t.summary_md) &&
    Array.isArray(t.products) &&
    t.products.length > 0 &&
    t.products.every(isTargetProduct) &&
    isString(t.install_source) &&
    typeof t.order === "number" &&
    (t.link_template === undefined ||
      (isString(t.link_template) && t.link_template.startsWith("https://"))) &&
    (t.docs_url === undefined || (isString(t.docs_url) && t.docs_url.startsWith("https://"))) &&
    (referral === null ||
      (typeof referral === "object" &&
        referral !== null &&
        isString((referral as Record<string, unknown>).program) &&
        isString((referral as Record<string, unknown>).param)))
  );
}

/** Keeps the rows it understands, drops the rest (a row it cannot render is never shown). */
export function parseTargets(raw: unknown): HostingTarget[] {
  return Array.isArray(raw) ? raw.filter(isTarget) : [];
}
