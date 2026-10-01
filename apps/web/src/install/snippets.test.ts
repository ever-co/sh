import { describe, expect, it } from "vitest";

import { pageAt } from "~/content";
import { PRODUCTS } from "~/products";

import { normalizeConnectCode } from "./connect";
import {
  CODE_PLACEHOLDER,
  composeSnippet,
  envSnippet,
  helmSnippet,
  type SnippetKind,
  snippet,
} from "./snippets";

const CODE = "EVC-7K2M-9QHX-3RTW";
const KINDS: SnippetKind[] = ["compose", "env", "helm"];

describe("install settings", () => {
  it("tag the install source and keep statistics on with the way to turn them off", () => {
    for (const kind of KINDS) {
      const s = snippet(kind, { product: "gauzy" }) ?? "";
      expect(s).toMatch(/EVER_INSTALL_SOURCE(=|: "|\n\s+value: ")ever\.sh/);
      expect(s).toMatch(/EVER_STATS_ENABLED(=|: "|\n\s+value: ")true/);
      expect(s).toContain("Set to false to turn them off completely.");
    }
  });

  it("leave the connection off without a code", () => {
    const env = envSnippet({ product: "gauzy" });
    expect(env).toMatch(/^# EVER_CONNECT_ENABLED=true$/m);
    expect(env).not.toMatch(/^EVER_CONNECT_ENABLED/m);
    expect(env).toContain(`# EVER_CONNECT_CODE=${CODE_PLACEHOLDER}`);
    expect(composeSnippet({ product: "gauzy" })).toMatch(/^\s+# EVER_CONNECT_ENABLED: "true"$/m);
    expect(helmSnippet({ product: "gauzy" })).toMatch(/^\s+# - name: EVER_CONNECT_ENABLED$/m);
  });

  it("turn the connection on only with a valid code", () => {
    const env = envSnippet({ product: "works", connect: CODE });
    expect(env).toMatch(/^EVER_CONNECT_ENABLED=true$/m);
    expect(env).toMatch(/^EVER_CONNECT_CODE=EVC-7K2M-9QHX-3RTW$/m);
    const helm = helmSnippet({ product: "teams", connect: CODE }) ?? "";
    expect(helm).toContain('value: "EVC-7K2M-9QHX-3RTW"');
    expect(helm).toMatch(/^ {4}- name: EVER_CONNECT_ENABLED$/m);
  });

  it("never contain a rejected value", () => {
    const rejected = normalizeConnectCode('EVC-7K2M-9QHX-3RTI"><b>');
    for (const kind of KINDS) {
      const s = snippet(kind, { product: "gauzy", connect: rejected }) ?? "";
      expect(s).not.toContain("3RTI");
      expect(s).not.toContain("<b>");
      expect(s).toContain(CODE_PLACEHOLDER);
    }
  });

  it("address each product's own API service and chart", () => {
    expect(composeSnippet({ product: "gauzy" })).toMatch(/^services:\n {2}api:\n/);
    expect(composeSnippet({ product: "works" })).toMatch(/^services:\n {2}ever-works-api:\n/);
    expect(composeSnippet({ product: "traduora" })).toMatch(/^services:\n {2}traduora:\n/);
    expect(composeSnippet({ product: "rec" })).toBeUndefined();
    expect(helmSnippet({ product: "gauzy" })).toMatch(/^ever-gauzy-api:\n {2}envs:\n/);
    expect(helmSnippet({ product: "works" })).toBeUndefined();
  });

  it("can render every kind each install page lists", () => {
    for (const product of PRODUCTS.filter((p) => p.status === "available")) {
      const page = pageAt(`/install/${product.id}`);
      expect(page?.snippets?.length, product.id).toBeGreaterThan(0);
      for (const kind of page?.snippets ?? []) {
        expect(snippet(kind, { product: product.id }), `${product.id} ${kind}`).toBeDefined();
      }
    }
  });
});
