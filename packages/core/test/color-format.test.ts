import { describe, it, expect } from "vitest";
import { formatColor, resolveLchToHex } from "../src/parser/color-resolver.js";

describe("formatColor", () => {
  it("formats an opaque hex as rgb()", () => {
    expect(formatColor("#000000", "rgba")).toBe("rgb(0, 0, 0)");
  });

  it("formats an alpha rgba() string as rgba()", () => {
    expect(formatColor("rgba(0, 0, 0, 0.56)", "rgba")).toBe("rgba(0, 0, 0, 0.56)");
  });

  it("formats an opaque hex as 8-digit hex", () => {
    expect(formatColor("#000000", "hex8")).toBe("#000000ff");
  });

  it("formats an alpha colour as 8-digit hex with the alpha channel", () => {
    expect(formatColor("rgba(0, 0, 0, 0.56)", "hex8")).toBe("#0000008f");
  });

  it("normalizes to 6-digit hex", () => {
    expect(formatColor("#2072B6", "hex")).toBe("#2072b6");
  });

  it("passes a non-colour value through unchanged", () => {
    expect(formatColor("16px", "rgba")).toBe("16px");
    expect(formatColor("1.5", "hex8")).toBe("1.5");
  });

  it("passes a non-string value through unchanged", () => {
    expect(formatColor(42, "rgba")).toBe(42);
  });

  it("gamut-maps an out-of-gamut lch() the same way resolveLchToHex does", () => {
    // gamut.ts is the sole owner of the gamut decision — formatColor must
    // route through it rather than clipping. Both must land on the mapped
    // value (#ff8c71), not the per-channel clip (#ff7652).
    expect(formatColor("lch(72% 84 40)", "hex")).toBe(resolveLchToHex("lch(72% 84 40)"));
    expect(formatColor("lch(72% 84 40)", "hex")).toBe("#ff8c71");
  });
});
