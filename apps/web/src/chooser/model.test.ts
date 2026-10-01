import { describe, expect, it } from "vitest";

import snapshot from "~/content.generated/hosts.json";

import { columnsFor, type HostingTarget, parseTargets, statusFor } from "./model";
import { docsLink, renderLink } from "./render";

const t = (over: Partial<HostingTarget>): HostingTarget => ({
  id: "x",
  kind: "third_party",
  title: "X",
  summary_md: "Summary.",
  products: [{ id: "gauzy", status: "available" }],
  install_source: "partner:x",
  snippet_kind: "none",
  referral: null,
  order: 10,
  status: "available",
  ...over,
});

describe("columns", () => {
  it("groups by column in a fixed order and hides empty columns", () => {
    const cols = columnsFor(
      [
        t({ id: "b", order: 20 }),
        t({ id: "a", order: 10 }),
        t({ id: "compose", kind: "self_host" }),
      ],
      "gauzy",
    );
    expect(cols.map((c) => c.kind)).toEqual(["self_host", "third_party"]);
    expect(cols.map((c) => c.heading)).toEqual(["Run it yourself", "Third-party hosts"]);
    expect(cols[1]?.targets.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("puts soon entries last and hides targets without the product", () => {
    const cols = columnsFor(
      [
        t({ id: "later", order: 1, products: [{ id: "gauzy", status: "soon" }] }),
        t({ id: "now", order: 50 }),
        t({ id: "teams-only", products: [{ id: "teams", status: "available" }] }),
      ],
      "gauzy",
    );
    expect(cols[0]?.targets.map((x) => x.id)).toEqual(["now", "later"]);
  });

  it("shows Ever Demand as soon in every column, whatever the data says", () => {
    const wrong = t({ products: [{ id: "demand", status: "available" }] });
    expect(statusFor(wrong, "demand")).toBe("soon");
    expect(renderLink(wrong, "demand")).toBeUndefined();
    for (const target of parseTargets(snapshot.targets)) {
      if (target.products.some((p) => p.id === "demand")) {
        expect(statusFor(target, "demand")).toBe("soon");
        expect(renderLink(target, "demand")).toBeUndefined();
      }
    }
  });
});

describe("links", () => {
  it("fills the product and drops an empty connect parameter", () => {
    const compose = t({
      id: "docker-compose",
      kind: "self_host",
      link_template: "https://site.example/install/{product}?connect={connect}",
    });
    expect(renderLink(compose, "gauzy")).toEqual({
      href: "https://site.example/install/gauzy",
      rel: "",
      external: false,
      referral: false,
    });
    expect(renderLink(compose, "gauzy", "EVC-7K2M-9QHX-3RTW")?.href).toBe(
      "https://site.example/install/gauzy?connect=EVC-7K2M-9QHX-3RTW",
    );
  });

  it("never guesses another placeholder", () => {
    const target = t({ link_template: "https://x.example/a?p={product}&back={return_to}" });
    expect(renderLink(target, "gauzy")?.href).toBe("https://x.example/a?p=gauzy");
    expect(
      renderLink(t({ link_template: "https://x.example/{region}/a" }), "gauzy"),
    ).toBeUndefined();
  });

  it("marks only links that carry Ever's referral code as sponsored", () => {
    const plain = t({
      products: [{ id: "teams", status: "available", link: "https://host.example/deploy" }],
    });
    expect(renderLink(plain, "teams")).toMatchObject({
      rel: "noopener",
      external: true,
      referral: false,
    });
    const sponsored = t({
      products: [{ id: "teams", status: "available", link: "https://host.example/t?ref_code=1" }],
      referral: { program: "host-affiliate", param: "ref_code" },
    });
    expect(renderLink(sponsored, "teams")).toMatchObject({
      href: "https://host.example/t?ref_code=1",
      rel: "sponsored noopener",
      referral: true,
    });
  });

  it("renders the snapshot's referral hosts with Ever's codes and nobody else's", () => {
    const targets = parseTargets(snapshot.targets);
    const hostinger = targets.find((x) => x.id === "hostinger");
    const railway = targets.find((x) => x.id === "railway");
    expect(hostinger && renderLink(hostinger, "gauzy")?.href).toContain("aff_id=244060");
    expect(railway && renderLink(railway, "teams")?.href).toContain("referralCode=40jeja");
    const sponsored = targets.filter((x) => x.referral !== null).map((x) => x.id);
    expect(sponsored).toEqual(["hostinger", "railway"]);
  });

  it("renders a guide link for the product", () => {
    const target = t({ kind: "self_host", docs_url: "https://site.example/{product}/docker" });
    expect(docsLink(target, "teams")).toBe("https://site.example/teams/docker");
    expect(docsLink(t({}), "teams")).toBeUndefined();
  });
});

describe("parsing", () => {
  it("drops rows it does not understand", () => {
    const rows = [
      { id: 1 },
      t({}),
      { ...t({}), kind: "elsewhere" },
      { ...t({}), products: [{ id: "iq", status: "available" }] },
      { ...t({}), link_template: "http://insecure.example/" },
    ];
    expect(parseTargets(rows).length).toBe(1);
    expect(parseTargets(undefined)).toEqual([]);
  });

  it("understands every row of the committed snapshot", () => {
    expect(parseTargets(snapshot.targets).length).toBe(snapshot.targets.length);
  });
});
