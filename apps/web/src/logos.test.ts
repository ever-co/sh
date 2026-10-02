import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseTargets } from "./chooser/model";
import snapshot from "./content.generated/hosts.json";
import { allLogos, hostLogo, PRODUCT_LOGOS, SITE_WORDMARK } from "./logos";
import { PRODUCTS } from "./products";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const read = (src: string) => readFileSync(`${PUBLIC}${src}`, "utf8");

describe("logos", () => {
  it("point at files that exist, with the proportions of their viewBox", () => {
    for (const logo of allLogos()) {
      const svg = read(logo.src);
      const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number);
      expect(viewBox, logo.src).toHaveLength(4);
      expect(viewBox?.[2], `${logo.src} width`).toBeCloseTo(logo.width, 2);
      expect(viewBox?.[3], `${logo.src} height`).toBeCloseTo(logo.height, 2);
      expect(svg, `${logo.src} has a title`).toContain(`<title>${logo.alt}</title>`);
    }
  });

  it("name the brand in their text alternative", () => {
    for (const logo of allLogos()) expect(logo.alt.trim(), logo.src).not.toBe("");
    expect(SITE_WORDMARK.alt).toBe("ever.sh");
  });

  it("give every Ever product its lockup", () => {
    for (const p of PRODUCTS) expect(PRODUCT_LOGOS[p.id].alt).toBe(p.name);
  });

  it("give every host of the hosting list a logo, except two that have a neutral icon", () => {
    const without = parseTargets(snapshot.targets)
      .filter((t) => hostLogo(t.id) === undefined)
      .map((t) => t.id);
    // "Your own server" is no brand; Fly.io's guidelines ask for written permission first.
    expect(without).toEqual(["bare-metal", "fly"]);
  });

  it("never treat an inherited property name as a host", () => {
    expect(hostLogo("constructor")).toBeUndefined();
    expect(hostLogo("toString")).toBeUndefined();
  });
});
