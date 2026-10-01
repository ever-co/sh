/**
 * The settings an install page gives: pure functions (unit-tested), rendered inside
 * `<pre><code>` by `/install/<product>`.
 *
 * Every snippet states, in this order:
 *   - `EVER_INSTALL_SOURCE=ever.sh`: how this install was set up. It is one field of the anonymous
 *     usage statistics and is only ever taken from this setting, never guessed.
 *   - `EVER_STATS_ENABLED=true`: anonymous usage statistics are on by default; the comment gives
 *     the one-line way to turn them off.
 *   - `EVER_CONNECT_ENABLED` / `EVER_CONNECT_CODE`: set only when the visitor asked to connect the
 *     install to their Ever organization (a valid `?connect=` code). Without a code they stay
 *     commented out: nothing connects until the operator turns it on.
 */
import type { ProductId } from "~/products";

export type SnippetKind = "compose" | "env" | "helm";

export interface SnippetInput {
  readonly product: ProductId;
  /** A validated code (`normalizeConnectCode`), or undefined. */
  readonly connect?: string | undefined;
}

/** The placeholder shown where a code would go. */
export const CODE_PLACEHOLDER = "EVC-XXXX-XXXX-XXXX";

/** The Compose service that runs each product's API (the one that reads these settings). */
const COMPOSE_SERVICE: Partial<Record<ProductId, string>> = {
  gauzy: "api",
  teams: "api",
  works: "ever-works-api",
  traduora: "traduora",
};

/** The values key of the API in each product's Helm chart (`ever-co/ever-gauzy`, `-teams-stack`). */
const HELM_API_KEY: Partial<Record<ProductId, string>> = {
  gauzy: "ever-gauzy-api",
  teams: "ever-gauzy-api",
};

interface Setting {
  readonly comment?: string;
  readonly name: string;
  readonly value: string;
  /** Shown commented out (not applied). */
  readonly off?: boolean;
}

function settings(connect: string | undefined): Setting[] {
  const list: Setting[] = [
    {
      comment: "How this install was set up (reported in anonymous usage statistics).",
      name: "EVER_INSTALL_SOURCE",
      value: "ever.sh",
    },
    {
      comment: "Anonymous usage statistics. Set to false to turn them off completely.",
      name: "EVER_STATS_ENABLED",
      value: "true",
    },
  ];
  if (connect) {
    list.push(
      {
        comment:
          "Connect this install to your Ever organization (the code works once, within 24 hours).",
        name: "EVER_CONNECT_ENABLED",
        value: "true",
      },
      { name: "EVER_CONNECT_CODE", value: connect },
    );
  } else {
    list.push(
      {
        comment: "Not connected. To connect later, create a code in your Ever account and set:",
        name: "EVER_CONNECT_ENABLED",
        value: "true",
        off: true,
      },
      { name: "EVER_CONNECT_CODE", value: CODE_PLACEHOLDER, off: true },
    );
  }
  return list;
}

export function envSnippet({ connect }: SnippetInput): string {
  const lines = settings(connect).flatMap((s) => [
    ...(s.comment ? [`# ${s.comment}`] : []),
    `${s.off ? "# " : ""}${s.name}=${s.value}`,
  ]);
  return `${lines.join("\n")}\n`;
}

/** A `docker-compose.override.yml` for the product's API service. */
export function composeSnippet({ product, connect }: SnippetInput): string | undefined {
  const service = COMPOSE_SERVICE[product];
  if (!service) return undefined;
  const lines = settings(connect).flatMap((s) => [
    ...(s.comment ? [`      # ${s.comment}`] : []),
    `      ${s.off ? "# " : ""}${s.name}: "${s.value}"`,
  ]);
  return `services:\n  ${service}:\n    environment:\n${lines.join("\n")}\n`;
}

/** Values for the product's Helm chart (the API's free-form `envs` list). */
export function helmSnippet({ product, connect }: SnippetInput): string | undefined {
  const key = HELM_API_KEY[product];
  if (!key) return undefined;
  const lines = settings(connect).flatMap((s) => {
    const prefix = s.off ? "    # " : "    ";
    const entry = [`${prefix}- name: ${s.name}`, `${prefix}  value: "${s.value}"`];
    return [...(s.comment ? [`    # ${s.comment}`] : []), ...entry];
  });
  return `${key}:\n  envs:\n${lines.join("\n")}\n`;
}

/** The snippet of `kind` for the product, or undefined when the product has no such form. */
export function snippet(kind: SnippetKind, input: SnippetInput): string | undefined {
  switch (kind) {
    case "compose":
      return composeSnippet(input);
    case "helm":
      return helmSnippet(input);
    case "env":
      return envSnippet(input);
  }
}

export const SNIPPET_LABELS: Record<
  SnippetKind,
  { readonly title: string; readonly file: string }
> = {
  compose: {
    title: "Docker Compose",
    file: "docker-compose.override.yml, next to the product's docker-compose.yml",
  },
  env: { title: "Environment file", file: ".env, or the environment file your install reads" },
  helm: { title: "Helm values", file: "values.yaml, passed to helm install with -f values.yaml" },
};
