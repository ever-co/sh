import { describe, expect, it } from "vitest";

import { connectStartUrl, normalizeConnectCode, parseInstallParams } from "./connect";

describe("connect codes", () => {
  it("accepts the grammar, case-insensitively, and normalizes to upper case", () => {
    expect(normalizeConnectCode("evc-7k2m-9qhx-3rtw")).toBe("EVC-7K2M-9QHX-3RTW");
    expect(normalizeConnectCode(" EVC-7K2M-9QHX-3RTW ")).toBe("EVC-7K2M-9QHX-3RTW");
  });

  it("rejects look-alike letters, stray characters and anything else", () => {
    for (const bad of [
      "EVC-7K2M-9QHX-3RTI",
      "EVC-7K2M-9QHX-3RTO",
      "EVC-7K2M-9QHX",
      "EVC-7K2M-9QHX-3RTW-9QHX",
      "EVL-7K2M-9QHX-3RTW",
      "EVC 7K2M 9QHX 3RTW",
      "<script>",
      "",
      null,
      undefined,
    ]) {
      expect(normalizeConnectCode(bad)).toBeUndefined();
    }
  });

  it("never echoes a rejected value and says it was rejected", () => {
    const p = parseInstallParams(new URLSearchParams("connect=%22%3E%3Cimg%20src%3Dx%3E"));
    expect(p).toEqual({ rejectedConnect: true });
    expect(JSON.stringify(p)).not.toContain("img");
  });

  it("treats an absent or empty value as no code", () => {
    expect(parseInstallParams(new URLSearchParams(""))).toEqual({ rejectedConnect: false });
    expect(parseInstallParams(new URLSearchParams("connect="))).toEqual({ rejectedConnect: false });
    expect(parseInstallParams(new URLSearchParams("connect=evc-7k2m-9qhx-3rtw"))).toEqual({
      connect: "EVC-7K2M-9QHX-3RTW",
      rejectedConnect: false,
    });
  });

  it("builds the portal link back to this page", () => {
    const url = new URL(connectStartUrl("https://app.example", "https://site.example", "gauzy"));
    expect(url.origin + url.pathname).toBe("https://app.example/connect/new");
    expect(url.searchParams.get("product")).toBe("gauzy");
    expect(url.searchParams.get("return_to")).toBe("https://site.example/install/gauzy");
    expect(url.searchParams.get("source")).toBe("ever.sh");
  });
});
