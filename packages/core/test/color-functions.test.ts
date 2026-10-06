import { describe, it, expect } from "vitest";
import {
  parse,
  formatHex,
  formatHex8,
  toGamut,
  converter,
  differenceCiede2000,
  differenceEuclidean,
  wcagContrast,
} from "culori";
import {
  oklchToHex,
  hexToOklch,
  contrastWcag,
  deltaE2000,
  deltaEOK,
  composite,
  withAlpha,
  alphaOf,
} from "../src/index.js";

// Reference values come straight from culori, so every function is pinned to
// the library value for value, not to a recorded number.

const COLORS = [
  "#000000",
  "#ffffff",
  "#808080",
  "#2072b6",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#e5484d",
  "#12a594",
  "#fdfdfc",
  "#111110",
  "rgb(32 114 182)",
  "oklch(0.7 0.12 250)",
];

const pairs = COLORS.flatMap((a) => COLORS.map((b) => [a, b] as const));

describe("oklchToHex", () => {
  const ref = (l: number, c: number, h: number) =>
    formatHex(toGamut("rgb", "oklch")({ mode: "oklch", l, c, h }));

  it("matches culori's CSS Color 4 gamut mapping across a grid, in and out of gamut", () => {
    for (let l = 0; l <= 1; l += 0.05)
      for (const c of [0, 0.02, 0.08, 0.15, 0.25, 0.37])
        for (let h = 0; h < 360; h += 30) expect(oklchToHex(l, c, h)).toBe(ref(l, c, h));
  });

  it("round-trips an in-gamut colour", () => {
    const { l, c, h } = hexToOklch("#2072b6");
    expect(oklchToHex(l, c, h!)).toBe("#2072b6");
  });
});

describe("hexToOklch", () => {
  const toOklch = converter("oklch");

  it("matches culori for every colour", () => {
    for (const color of COLORS) {
      const ref = toOklch(parse(color));
      expect(hexToOklch(color)).toEqual({ l: ref.l, c: ref.c ?? 0, h: ref.h });
    }
  });

  it("leaves the hue undefined for an achromatic colour", () => {
    expect(hexToOklch("#808080").h).toBeUndefined();
  });
});

describe("contrastWcag", () => {
  it("matches culori for every pair", () => {
    for (const [a, b] of pairs) expect(contrastWcag(a, b)).toBe(wcagContrast(a, b));
  });

  it("is 21 for black on white", () => {
    expect(contrastWcag("#000", "#fff")).toBe(21);
  });
});

describe("deltaE2000", () => {
  const ref = differenceCiede2000();
  it("matches culori for every pair", () => {
    for (const [a, b] of pairs) expect(deltaE2000(a, b)).toBe(ref(parse(a), parse(b)));
  });
});

describe("deltaEOK", () => {
  const ref = differenceEuclidean("oklab");
  it("matches culori for every pair", () => {
    for (const [a, b] of pairs) expect(deltaEOK(a, b)).toBe(ref(parse(a), parse(b)));
  });
});

describe("composite", () => {
  // Source-over on an opaque base, written out per channel.
  const over = (layer: string, base: string) => {
    const rgb = converter("rgb");
    const l = rgb(parse(layer));
    const b = rgb(parse(base));
    const a = l.alpha ?? 1;
    const ch = (k: "r" | "g" | "b") => l[k] * a + b[k] * (1 - a);
    return formatHex({ mode: "rgb", r: ch("r"), g: ch("g"), b: ch("b") });
  };

  it("matches source-over onto an opaque base for every pair and alpha", () => {
    for (const [a, b] of pairs)
      for (const alpha of [0, 0.04, 0.1, 0.33, 0.5, 0.9, 1]) {
        const layer = formatHex8({ ...parse(a), alpha });
        expect(composite(layer, b)).toBe(over(layer, b));
      }
  });

  it("returns the base for a transparent layer and the layer for an opaque one", () => {
    expect(composite("#ff000000", "#2072b6")).toBe("#2072b6");
    expect(composite("#ff0000", "#2072b6")).toBe("#ff0000");
  });

  it("keeps translucency when the base is translucent", () => {
    // half red over half blue: alpha ≈ 0.75, red weighted about 2:1
    const a = 128 / 255;
    const alpha = a + a * (1 - a);
    expect(composite("#ff000080", "#0000ff80")).toBe(
      formatHex8({ mode: "rgb", r: a / alpha, g: 0, b: (a * (1 - a)) / alpha, alpha }),
    );
  });
});

describe("withAlpha", () => {
  it("matches culori's hex8 with the alpha replaced", () => {
    for (const color of COLORS)
      for (const alpha of [0, 0.06, 0.5, 1])
        expect(withAlpha(color, alpha)).toBe(formatHex8({ ...parse(color), alpha }));
  });
});

describe('format "srgb"', () => {
  const rgb = converter("rgb");
  // source-over in floats, the reference a chain of steps must not drift from
  const over = (l: any, b: any) => {
    const a = l.alpha ?? 1;
    const ch = (k: "r" | "g" | "b") => l[k] * a + b[k] * (1 - a);
    return { mode: "rgb", r: ch("r"), g: ch("g"), b: ch("b") };
  };

  it("composites a chain of translucent layers without rounding", () => {
    const layers = ["rgba(32, 114, 182, 0.72)", "rgba(229, 72, 77, 0.33)", "rgba(18, 165, 148, 0.5)"];
    const exact = layers.reduceRight((below: any, c) => over(rgb(parse(c)), below), { mode: "rgb", r: 1, g: 1, b: 1 });
    const chained = layers.reduceRight((below, c) => composite(c, below, { format: "srgb" }), "#ffffff");
    const got = rgb(parse(chained))!;
    for (const k of ["r", "g", "b"] as const) expect(got[k]).toBeCloseTo(exact[k], 12);
    // the hex chain rounds at every step
    expect(layers.reduceRight((below, c) => composite(c, below), "#ffffff")).not.toBe(chained);
  });

  it("writes color(srgb …), with alpha only when translucent", () => {
    expect(composite("#ff0000", "#0000ff", { format: "srgb" })).toBe("color(srgb 1 0 0)");
    expect(composite("#ff000080", "#0000ff00", { format: "srgb" })).toBe(`color(srgb 1 0 0 / ${128 / 255})`);
    expect(withAlpha("#2072b6", 0.72, { format: "srgb" })).toBe(`color(srgb ${32 / 255} ${114 / 255} ${182 / 255} / 0.72)`);
    expect(contrastWcag(withAlpha("#000", 1, { format: "srgb" }), "#fff")).toBe(21);
  });

  it("leaves the hex output as it was", () => {
    expect(composite("#ff000080", "#ffffff", { format: "hex" })).toBe(composite("#ff000080", "#ffffff"));
    expect(withAlpha("#2072b6", 0.5, {})).toBe(withAlpha("#2072b6", 0.5));
  });
});

describe("alphaOf", () => {
  it("reads the alpha as written", () => {
    expect(alphaOf("#2072b6")).toBe(1);
    expect(alphaOf("#2072b680")).toBe(128 / 255);
    expect(alphaOf("rgba(0, 0, 0, 0.72)")).toBe(0.72);
    expect(alphaOf("oklch(0.7 0.12 250 / 0.4)")).toBe(0.4);
    expect(alphaOf("transparent")).toBe(0);
    expect(() => alphaOf("nope")).toThrow(/Not a colour/);
  });
});

describe("unparseable input", () => {
  it("throws instead of returning a number", () => {
    expect(() => contrastWcag("16px", "#fff")).toThrow(TypeError);
    expect(() => hexToOklch("nope")).toThrow(TypeError);
  });
});
