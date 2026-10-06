import { describe, it, expect } from "vitest";
import { converter, parse, formatHex } from "culori";
import { mapToSrgbGamut } from "../src/parser/gamut.js";

describe("mapToSrgbGamut", () => {
  // Values cross-checked against colorjs.io's toGamut() default, which is what
  // @tokens-studio/sd-transforms uses to produce the shipped CSS.
  it("reduces chroma instead of clipping channels", () => {
    expect(formatHex(mapToSrgbGamut(parse("lch(72% 84 40)")))).toBe("#ff8c71");
  });

  it("pulls a very light out-of-gamut ramp step to a tint", () => {
    // Clipping would keep a saturated peach (#ffbe92); mapping gives an off-white.
    expect(formatHex(mapToSrgbGamut(parse("lch(97% 84 40)")))).toBe("#fff6f0");
  });

  it("leaves an in-gamut colour untouched", () => {
    expect(formatHex(mapToSrgbGamut(parse("lch(45% 60 300)")))).toBe("#745ac3");
  });

  it("handles an achromatic colour without producing NaN", () => {
    expect(formatHex(mapToSrgbGamut(parse("#ffffff")))).toBe("#ffffff");
    expect(formatHex(mapToSrgbGamut(parse("#000000")))).toBe("#000000");
  });

  it("returns a colour inside sRGB unchanged: corners, white and black", () => {
    const rgb = converter("rgb");
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#00ffff", "#ff00ff", "#ffff00", "#ffffff", "#000000"]) {
      const out = mapToSrgbGamut(parse(hex)) as { mode: string; r: number; g: number; b: number };
      const exact = rgb(parse(hex))!;
      expect(out.mode, hex).toBe("rgb");
      expect([out.r, out.g, out.b], hex).toEqual([exact.r, exact.g, exact.b]);
    }
  });

  it("still maps a colour outside sRGB", () => {
    const out = mapToSrgbGamut(parse("oklch(0.7 0.4 30)")) as { r: number; g: number; b: number };
    for (const v of [out.r, out.g, out.b]) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
  });
});
