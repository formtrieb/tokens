import { describe, it, expect } from "vitest";
import { resolveLchToHex, resolveLchToHexWithGamut } from "../src/parser/color-resolver.js";

/**
 * `resolveLchToHex` changed behaviour on the color-modifier-parity branch —
 * it now gamut-maps rather than clips — but nothing in the suite called it
 * directly. Its agreement with `resolveLchToHexWithGamut` rested on
 * inspection alone. These pin both functions against the same two inputs
 * cross-checked in gamut.test.ts.
 */
describe("resolveLchToHex", () => {
  it("gamut-maps an out-of-gamut colour", () => {
    expect(resolveLchToHex("lch(72% 84 40)")).toBe("#ff8c71");
  });

  it("leaves an in-gamut colour untouched", () => {
    expect(resolveLchToHex("lch(45% 60 300)")).toBe("#745ac3");
  });

  it("returns null for an unparseable value", () => {
    expect(resolveLchToHex("not-a-colour")).toBeNull();
  });
});

describe("resolveLchToHexWithGamut", () => {
  it("reports clipped: true and the mapped hex for an out-of-gamut colour", () => {
    expect(resolveLchToHexWithGamut("lch(72% 84 40)")).toEqual({
      hex: "#ff8c71",
      clipped: true,
    });
  });

  it("reports clipped: false for an in-gamut colour, matching resolveLchToHex", () => {
    const result = resolveLchToHexWithGamut("lch(45% 60 300)");
    expect(result).toEqual({ hex: "#745ac3", clipped: false });
    expect(result?.hex).toBe(resolveLchToHex("lch(45% 60 300)"));
  });

  it("returns null for an unparseable value", () => {
    expect(resolveLchToHexWithGamut("not-a-colour")).toBeNull();
  });
});
