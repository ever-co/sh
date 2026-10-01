/**
 * The HTTP rules serve.mjs applies (http-policy.mjs), the deployment settings (site-origin.mjs)
 * and the runtime-free page rule (runtime-free.mjs).
 */
import { describe, expect, it } from "vitest";

import { carriesConnectCode, policyHeaders, redirectFor } from "../http-policy.mjs";
import { isRuntimeFree, stripRuntime } from "../runtime-free.mjs";
import { readSiteConfig, validateOrigin } from "../site-origin.mjs";

const ORIGIN = "https://site.example";
const at = (path: string) => new URL(`${ORIGIN}${path}`);

describe("redirects", () => {
  it("send the older link shape to the install page, query preserved", () => {
    expect(redirectFor(at("/gauzy?connect=EVC-7K2M-9QHX-3RTW"), ORIGIN)).toEqual({
      status: 308,
      location: `${ORIGIN}/install/gauzy?connect=EVC-7K2M-9QHX-3RTW`,
    });
    // Ever Demand has no install page: nothing to redirect to.
    expect(redirectFor(at("/demand?connect=EVC-7K2M-9QHX-3RTW"), ORIGIN)).toBeNull();
    expect(redirectFor(at("/gauzy"), ORIGIN)).toBeNull();
  });

  it("send /install to the chooser", () => {
    expect(redirectFor(at("/install"), ORIGIN)).toEqual({
      status: 308,
      location: `${ORIGIN}/hosting`,
    });
  });

  it("lower-case paths (301) and drop trailing slashes (308)", () => {
    expect(redirectFor(at("/Gauzy/Docker"), ORIGIN)).toEqual({
      status: 301,
      location: `${ORIGIN}/gauzy/docker`,
    });
    expect(redirectFor(at("/gauzy/docker/"), ORIGIN)).toEqual({
      status: 308,
      location: `${ORIGIN}/gauzy/docker`,
    });
    expect(redirectFor(at("/hosting/?product=teams"), ORIGIN)).toEqual({
      status: 308,
      location: `${ORIGIN}/hosting?product=teams`,
    });
    expect(redirectFor(at("/"), ORIGIN)).toBeNull();
  });

  it("never rewrite assets, files or framework endpoints", () => {
    expect(redirectFor(at("/_build/assets/Entry-AbC123.js"), ORIGIN)).toBeNull();
    expect(redirectFor(at("/favicon.svg"), ORIGIN)).toBeNull();
    expect(redirectFor(at("/Gauzy/Docker.md"), ORIGIN)).toBeNull();
    expect(redirectFor(at("/_server"), ORIGIN)).toBeNull();
  });

  it("never point at another host", () => {
    for (const path of ["//EVIL", "//evil/", "///evil"]) {
      const r = redirectFor(at(path), ORIGIN);
      expect(r?.location.startsWith(`${ORIGIN}/`), path).toBe(true);
      expect(new URL(r?.location ?? "").host).toBe("site.example");
    }
  });
});

describe("response headers", () => {
  it("forbid framing and sniffing everywhere and keep non-indexable hosts out of search", () => {
    const headers = policyHeaders(at("/gauzy"), { indexable: false });
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-robots-tag"]).toBe("noindex");
    expect(policyHeaders(at("/gauzy"), { indexable: true })["x-robots-tag"]).toBeUndefined();
  });

  it("make a page with a connect code personal", () => {
    const url = at("/install/gauzy?connect=EVC-7K2M-9QHX-3RTW");
    expect(carriesConnectCode(url)).toBe(true);
    const headers = policyHeaders(url, { indexable: true });
    expect(headers["x-robots-tag"]).toBe("noindex");
    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(carriesConnectCode(at("/install/gauzy"))).toBe(false);
  });
});

describe("deployment settings", () => {
  it("default to a local origin, the public portal and not indexable", () => {
    expect(readSiteConfig({})).toEqual({
      site: "http://127.0.0.1:3000",
      app: "https://app.ever.co",
      indexable: false,
    });
    expect(readSiteConfig({ EVER_SH_INDEXABLE: "true" }).indexable).toBe(true);
  });

  it("refuse malformed values instead of guessing", () => {
    expect(() => readSiteConfig({ EVER_SH_INDEXABLE: "yes" })).toThrow(/EVER_SH_INDEXABLE/);
    for (const bad of [
      "site.example",
      "ftp://site.example",
      "https://u:p@site.example",
      "https://site.example/x",
      "https://site.example/?q=1",
    ]) {
      expect(() => validateOrigin("EVER_SH_URL", bad), bad).toThrow();
    }
    expect(validateOrigin("EVER_SH_URL", "https://site.example/")).toBe("https://site.example");
  });
});

describe("runtime-free pages", () => {
  it("cover everything but the chooser", () => {
    for (const path of [
      "/",
      "/gauzy",
      "/gauzy/docker",
      "/demand",
      "/platform/connect",
      "/install/gauzy",
    ]) {
      expect(isRuntimeFree(path), path).toBe(true);
    }
    for (const path of ["/hosting", "/unknown-thing/x/y"]) {
      expect(isRuntimeFree(path), path).toBe(false);
    }
  });

  it("lose every script and module preload, and keep their stylesheet", () => {
    const html =
      '<head><script>window._$HY={}</script><link href="/_build/a.css" rel="stylesheet" />' +
      '<link href="/_build/a.js" rel="modulepreload" /></head><body><p>x</p><script type="module" src="/e.js"></script></body>';
    expect(stripRuntime(html)).toBe(
      '<head><link href="/_build/a.css" rel="stylesheet" /></head><body><p>x</p></body>',
    );
  });
});
