import { converter, displayable, toGamut } from "culori";

/**
 * Map a colour into the sRGB gamut by reducing OKLCH chroma — the CSS Color 4
 * §13 algorithm.
 *
 * This is deliberately NOT `formatHex`'s per-channel clip, and deliberately NOT
 * culori's `clampChroma`. `@tokens-studio/sd-transforms` gamut-maps via
 * colorjs.io's `toString({ inGamut: true })`, whose default is exactly this
 * algorithm; `clampChroma` converges elsewhere and produces visibly different
 * colours (e.g. `lch(72% 84 40)` → 255,148,125 instead of 255,140,113).
 *
 * Sole owner of the gamut decision: both the plain `lch()` path and the colour
 * modifier path route through here so they cannot drift apart.
 */
const map = toGamut("rgb", "oklch");
const toRgb = converter("rgb");

/**
 * A colour inside sRGB comes back as it is (in `rgb` mode, like a mapped
 * one); only a colour outside is mapped. The mapping round-trips through
 * OKLCH and would otherwise nudge colours on the gamut edge (`#ff0000` →
 * r 0.9999), enough to tip a value on a rounding boundary.
 */
export function mapToSrgbGamut<T>(color: T): T {
  return (displayable(color as never) ? toRgb(color as never) : map(color)) as T;
}

const GAMUT_EPSILON = 1e-5;

/**
 * Whether a colour lies outside sRGB. Conversions leave noise of up to about
 * 2e-6 per channel (white at r 1.0000001, a mapped colour round-tripped
 * through LCH at r -0.0000013); that is not a colour outside.
 */
export function isOutOfGamut(color: unknown): boolean {
  const { r, g, b } = toRgb(color as never);
  return [r, g, b].some((v: number) => v < -GAMUT_EPSILON || v > 1 + GAMUT_EPSILON);
}

/**
 * The colour in sRGB channels: mapped when it lies outside, else clamped —
 * a channel within the noise of an edge is the edge. Mapping such a colour
 * again would move it inward (`0%` → `0.0002%`).
 */
export function toSrgb(color: unknown): { mode: "rgb"; r: number; g: number; b: number; alpha?: number } {
  if (isOutOfGamut(color)) return map(color);
  const rgb = toRgb(color as never);
  const clamp = (v: number | undefined) => {
    const c = v ?? 0;
    return c < GAMUT_EPSILON ? 0 : c > 1 - GAMUT_EPSILON ? 1 : c;
  };
  return { ...rgb, r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b) };
}
