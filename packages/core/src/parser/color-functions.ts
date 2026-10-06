import {
  parse,
  formatHex,
  formatHex8,
  converter,
  displayable,
  differenceCiede2000,
  differenceEuclidean,
  wcagContrast,
} from "culori";
import { mapToSrgbGamut } from "./gamut.js";

/**
 * General colour functions for code that generates or checks colours: convert
 * between OKLCH and hex, measure contrast and distance, composite layers.
 *
 * Every argument named `color` is any CSS colour string culori parses (hex,
 * `rgb()`, `oklch()`, …). An unparseable string throws — a measurement of
 * "not a colour" has no meaningful number.
 */

const toRgb = converter("rgb");
const toOklch = converter("oklch");
const ciede2000 = differenceCiede2000();
const euclideanOklab = differenceEuclidean("oklab");

export interface Oklch {
  /** Lightness, 0..1. */
  l: number;
  /** Chroma, 0 and up. */
  c: number;
  /** Hue in degrees; undefined for an achromatic colour. */
  h: number | undefined;
}

function parseOrThrow(color: string): any {
  const parsed = typeof color === "string" ? parse(color) : undefined;
  if (!parsed) throw new TypeError(`Not a colour: ${String(color)}`);
  return parsed;
}

/**
 * As sRGB channels. Only a colour outside sRGB is gamut-mapped: the mapping
 * round-trips through OKLCH and nudges colours on the gamut edge (#ff0000 comes
 * back with r ≈ 0.9999), which compositing would carry into the result.
 */
function srgb(color: string): any {
  const parsed = parseOrThrow(color);
  return toRgb(displayable(parsed) ? parsed : mapToSrgbGamut(parsed));
}

/**
 * OKLCH → `#rrggbb`. Out-of-gamut values go through the same sRGB gamut
 * mapping as every other colour path in this package (CSS Color 4 §13).
 */
export function oklchToHex(l: number, c: number, h: number): string {
  return formatHex(mapToSrgbGamut({ mode: "oklch", l, c, h }));
}

/** Any colour → OKLCH. */
export function hexToOklch(color: string): Oklch {
  const { l, c, h } = toOklch(parseOrThrow(color));
  return { l, c: c ?? 0, h };
}

/** WCAG 2 contrast ratio, 1..21. Symmetric. */
export function contrastWcag(a: string, b: string): number {
  return wcagContrast(parseOrThrow(a), parseOrThrow(b));
}

/** CIEDE2000 colour difference. */
export function deltaE2000(a: string, b: string): number {
  return ciede2000(parseOrThrow(a), parseOrThrow(b));
}

/** Euclidean distance in OKLab, in OKLab units (a just-noticeable difference is about 0.02). */
export function deltaEOK(a: string, b: string): number {
  return euclideanOklab(parseOrThrow(a), parseOrThrow(b));
}

/**
 * Source-over compositing of `layer` onto `base` in sRGB, the way a browser
 * paints a translucent colour over another. Returns `#rrggbb` when the result
 * is opaque, `#rrggbbaa` otherwise.
 */
export function composite(layer: string, base: string): string {
  const top = srgb(layer);
  const bottom = srgb(base);
  const at = top.alpha ?? 1;
  const ab = bottom.alpha ?? 1;
  // written so an opaque base gives exactly 1, not 0.9999…
  const alpha = 1 - (1 - at) * (1 - ab);
  if (alpha === 0) return formatHex8({ mode: "rgb", r: 0, g: 0, b: 0, alpha: 0 });
  const ch = (k: "r" | "g" | "b") => (top[k] * at + bottom[k] * ab * (1 - at)) / alpha;
  const out = { mode: "rgb", r: ch("r"), g: ch("g"), b: ch("b"), alpha };
  return alpha === 1 ? formatHex(out) : formatHex8(out);
}

/** The colour with its alpha replaced, as `#rrggbbaa`. */
export function withAlpha(color: string, alpha: number): string {
  return formatHex8({ ...srgb(color), alpha });
}
