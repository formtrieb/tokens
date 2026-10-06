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
