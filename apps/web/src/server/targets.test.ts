import { describe, expect, it, vi } from "vitest";

import snapshot from "~/content.generated/hosts.json";

import { loadTargets, TIMEOUT_MS } from "./targets";

const BASE = "http://api-service.example:8080";
const ITEM = snapshot.targets[0];

function reply(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("hosting list read", () => {
  it("uses the API service's answer and its label", async () => {
    const fetchImpl = reply(200, { items: [ITEM], source: "api", as_of: "2026-10-02" });
    const result = await loadTargets(fetchImpl as unknown as typeof fetch, BASE);
    expect(result.source).toBe("api");
    expect(result.asOf).toBe("2026-10-02");
    expect(result.targets.map((t) => t.id)).toEqual([ITEM?.id]);
  });

  it("calls only the list endpoint, with no credential, no cookie and an 8 s limit", async () => {
    const fetchImpl = reply(200, { items: [ITEM], source: "snapshot", as_of: "2026-10-01" });
    await loadTargets(fetchImpl as unknown as typeof fetch, BASE);
    expect(TIMEOUT_MS).toBe(8_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${BASE}/v1/hosting-targets`);
    const headers = new Headers(init.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect([...headers.keys()]).toEqual(["accept"]);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
  });

  it.each([
    ["an error status", reply(404, { error: "not found" })],
    ["an empty list", reply(200, { items: [], source: "api", as_of: "2026-10-02" })],
    ["another shape", reply(200, { schema: "something.else", targets: [ITEM] })],
    ["no label", reply(200, { items: [ITEM] })],
  ])("falls back to the built-in snapshot on %s", async (_, fetchImpl) => {
    const result = await loadTargets(fetchImpl as unknown as typeof fetch, BASE);
    expect(result).toMatchObject({ source: "snapshot", asOf: snapshot.as_of });
    expect(result.targets.length).toBe(snapshot.targets.length);
  });

  it("falls back to the built-in snapshot when the service is unreachable or too slow", async () => {
    const down = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const result = await loadTargets(down as unknown as typeof fetch, BASE);
    expect(result.source).toBe("snapshot");
    expect(result.targets.length).toBeGreaterThan(0);
    const malformedBase = await loadTargets(down as unknown as typeof fetch, "not a url");
    expect(malformedBase.source).toBe("snapshot");
  });
});
