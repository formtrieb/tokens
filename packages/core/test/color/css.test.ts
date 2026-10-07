import { describe, expect, it } from "vitest";
import { cssColor, parseColor } from "../../src/index.js";

describe("cssColor — the one way a colour is written", () => {
  const half = { mode: "rgb", r: 0.2, g: 0.4, b: 0.6, alpha: 0.5 };
  const opaque = { mode: "rgb", r: 0.2, g: 0.4, b: 0.6 };

  it("writes four forms, alpha only when below 1", () => {
    expect(cssColor(half, "rgb")).toBe("rgba(51, 102, 153, 0.5)");
    expect(cssColor(opaque, "rgb")).toBe("rgb(51, 102, 153)");
    expect(cssColor(half, "hex")).toBe("#33669980");
    expect(cssColor(opaque, "hex")).toBe("#336699");
    expect(cssColor(half, "percent")).toBe("rgb(20% 40% 60% / 0.5)");
    expect(cssColor(opaque, "percent")).toBe("rgb(20% 40% 60%)");
    expect(cssColor(half, "srgb")).toBe("color(srgb 0.2 0.4 0.6 / 0.5)");
    expect(cssColor(opaque, "srgb")).toBe("color(srgb 0.2 0.4 0.6)");
  });

  it("maps a colour outside sRGB, and takes float noise at an edge as the edge", () => {
    expect(cssColor(parseColor("lch(62 72 250)")!, "rgb")).toBe("rgb(0, 165, 233)");
    expect(cssColor({ mode: "rgb", r: 0.000002, g: 0.5, b: 1.0000001 }, "percent")).toBe("rgb(0% 50% 100%)");
  });

  it("reads Tokens Studio's rgba(<colour>, alpha)", () => {
    expect(cssColor(parseColor("rgba(#336699, 50%)")!, "hex")).toBe("#33669980");
    expect(parseColor("linear-gradient(red, blue)")).toBeUndefined();
  });
});
