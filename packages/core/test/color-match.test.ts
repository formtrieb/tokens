import { describe, it, expect } from "vitest";
import { findColorMatches } from "../src/parser/color-match.js";

const CANDIDATES = [
  { path: "color.accent.primary", value: "#2072b6" },
  { path: "color.accent.aliased", value: "#2072B6" }, // same colour, different casing
  { path: "color.accent.near", value: "#2172b7" },
  { path: "color.danger", value: "#ff0000" },
  { path: "spacing.md", value: "16px" }, // non-colour, must be ignored
];

describe("findColorMatches", () => {
  it("finds all paths whose colour equals the query, regardless of casing/format", () => {
    const r = findColorMatches("#2072b6", CANDIDATES);
    expect(r.exact.sort()).toEqual(["color.accent.aliased", "color.accent.primary"]);
  });

  it("matches a query given as rgb() against hex candidates", () => {
    const r = findColorMatches("rgb(32, 114, 182)", CANDIDATES);
    expect(r.exact).toContain("color.accent.primary");
  });

  it("returns the nearest non-exact candidate by deltaE when requested", () => {
    const r = findColorMatches("#2072b6", CANDIDATES, { nearest: true });
    expect(r.nearest?.path).toBe("color.accent.near");
    expect(r.nearest?.deltaE).toBeCloseTo(0.22, 1);
  });

  it("omits nearest when not requested", () => {
    const r = findColorMatches("#2072b6", CANDIDATES);
    expect(r.nearest).toBeNull();
  });

  it("reports an unparseable query with a null queryHex and no matches", () => {
    const r = findColorMatches("not-a-colour", CANDIDATES, { nearest: true });
    expect(r.queryHex).toBeNull();
    expect(r.exact).toEqual([]);
    expect(r.nearest).toBeNull();
  });

  it("ignores non-colour candidates entirely", () => {
    const r = findColorMatches("#101010", CANDIDATES, { nearest: true });
    expect(r.exact).toEqual([]);
    expect(r.nearest?.path).not.toBe("spacing.md");
  });
});
