/**
 * Tokens Studio's colour modifiers as fixed values.
 *
 * Origin: each row is what @tokens-studio/sd-transforms 2 computed for the
 * base and modifier (8-bit sRGB channels and alpha), recorded on 2026-10-07 in
 * a last run before that package left this repository. The "real" rows are
 * the combinations real token sets use; they must match exactly. The "edge"
 * rows may differ by one 8-bit step where the modified colour lies outside
 * sRGB (culori and colorjs.io map the gamut by different searches).
 *
 * Two edge rows have a base outside sRGB. This package maps such a base into
 * sRGB before modifying (see `modifyColor`); sd-transforms modified the
 * unmapped base. Their values were recorded with the mapped base as input,
 * so they hold this package's rule. The other bases outside sRGB give the
 * same result either way.
 */
import { describe, expect, it } from "vitest";
import { cssColor, modifyColor, parseColor } from "../../src/index.js";

type Row = [set: "real" | "edge", base: string, type: string, amount: number, expected: [number, number, number, number]];

const ROWS: Row[] = [
  ["real", "#ffffff", "lighten", 0, [255, 255, 255, 1]],
  ["real", "#000000", "lighten", 0, [0, 0, 0, 1]],
  ["real", "#000000", "lighten", 0.2, [48, 48, 48, 1]],
  ["real", "#ffffff", "darken", 0.2, [198, 198, 198, 1]],
  ["real", "#f305b7", "darken", 0.2, [190, 25, 143, 1]],
  ["real", "#2072b6", "lighten", 0.2, [92, 140, 197, 1]],
  ["real", "#2072b6", "darken", 0.2, [33, 90, 143, 1]],
  ["real", "lch(72% 84 40)", "lighten", 0, [255, 140, 113, 1]],
  ["real", "lch(97% 84 40)", "lighten", 0, [255, 246, 240, 1]],
  ["real", "#ffffff", "alpha", 0.8, [255, 255, 255, 0.8]],
  ["real", "#000000", "alpha", 0.8, [0, 0, 0, 0.8]],
  ["real", "#ffffff", "alpha", 0.56, [255, 255, 255, 0.56]],
  ["real", "#000000", "alpha", 0.43, [0, 0, 0, 0.43]],
  ["real", "#000000", "alpha", 0.22, [0, 0, 0, 0.22]],
  ["real", "#ffffff", "alpha", 0.6, [255, 255, 255, 0.6]],
  ["real", "lch(72% 84 40)", "alpha", 0.8, [255, 140, 113, 0.8]],
  ["real", "rgba(0, 0, 0, 0.56)", "lighten", 0.2, [48, 48, 48, 0.56]],
  ["real", "rgba(0, 0, 0, 0.43)", "lighten", 0.2, [48, 48, 48, 0.43]],
  ["real", "rgba(0, 0, 0, 0.22)", "lighten", 0.2, [48, 48, 48, 0.22]],
  ["real", "rgba(255, 255, 255, 0.56)", "darken", 0.2, [198, 198, 198, 0.56]],
  ["real", "#2072b6", "alpha", 1.5, [32, 114, 182, 1]],
  ["real", "#2072b6", "alpha", -0.2, [32, 114, 182, 0]],
  ["edge", "#2072b6", "lighten", 1, [255, 255, 255, 1]],
  ["edge", "#2072b6", "darken", 1, [0, 0, 0, 1]],
  ["edge", "#808080", "darken", 0.5, [63, 63, 63, 1]],
  ["edge", "lch(60% 110 140)", "darken", 0.2, [21, 132, 37, 1]],
  ["edge", "lch(30% 70 20)", "lighten", 0.6, [222, 163, 163, 1]],
  ["edge", "rgba(0, 0, 0, 0.56)", "lighten", 0.3, [71, 71, 71, 0.56]],
];

describe("colour modifiers, fixed values", () => {
  it.each(ROWS)("%s: %s %s %s", (set, base, type, amount, [r, g, b, a]) => {
    const color = modifyColor(parseColor(base)!, { type, amount, space: "lch" });
    const got = parseColor(cssColor(color, "srgb"))!;
    const channels = [got.r, got.g, got.b].map((v) => Math.round((v as number) * 255));
    const tolerance = set === "real" ? 0 : 1;
    for (const [i, want] of [r, g, b].entries()) expect(Math.abs(channels[i]! - want), `channel ${i}`).toBeLessThanOrEqual(tolerance);
    expect(got.alpha ?? 1).toBeCloseTo(a, 6);
  });
});
