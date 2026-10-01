import { describe, expect, it } from "vitest";

import { INSTALLABLE } from "../http-policy.mjs";
import { installable, PRODUCTS, productById } from "./products";

describe("products", () => {
  it("lists exactly the six Ever products, in this order", () => {
    expect(PRODUCTS.map((p) => p.id)).toEqual([
      "gauzy",
      "teams",
      "works",
      "rec",
      "traduora",
      "demand",
    ]);
  });

  it("shows Ever Demand as soon, with no install page", () => {
    expect(productById("demand")?.status).toBe("soon");
    expect(installable("demand")).toBeUndefined();
    expect(PRODUCTS.filter((p) => p.status === "soon").map((p) => p.id)).toEqual(["demand"]);
  });

  it("matches the install list the server's redirects use", () => {
    expect(PRODUCTS.filter((p) => installable(p.id)).map((p) => p.id)).toEqual([...INSTALLABLE]);
  });

  it("finds nothing outside the list", () => {
    expect(productById("iq")).toBeUndefined();
    expect(productById("Gauzy")).toBeUndefined();
    expect(productById(undefined)).toBeUndefined();
  });
});
