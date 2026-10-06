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
 * How a colour function writes its result. `"hex"` (default): `#rrggbb`, or
 * `#rrggbbaa` when translucent — 8 bits per channel, what a token stores.
 * `"srgb"`: `color(srgb r g b / a)` at full precision, for code that chains
 * several steps and measures the result.
 */
export interface ColorOutput {
  format?: "hex" | "srgb";
}

function write(rgb: { r: number; g: number; b: number; alpha?: number }, output: ColorOutput, keepAlpha: boolean): string {
  const alpha = rgb.alpha ?? 1;
  if (output.format === "srgb") {
    return `color(srgb ${rgb.r} ${rgb.g} ${rgb.b}${keepAlpha || alpha !== 1 ? ` / ${alpha}` : ""})`;
  }
  const out = { mode: "rgb" as const, ...rgb, alpha };
  return alpha === 1 && !keepAlpha ? formatHex(out) : formatHex8(out);
}

/**
 * Source-over compositing of `layer` onto `base` in sRGB, the way a browser
 * paints a translucent colour over another. Returns `#rrggbb` when the result
 * is opaque, `#rrggbbaa` otherwise; `{ format: "srgb" }` returns it unrounded.
 */
export function composite(layer: string, base: string, output: ColorOutput = {}): string {
  const top = srgb(layer);
  const bottom = srgb(base);
  const at = top.alpha ?? 1;
  const ab = bottom.alpha ?? 1;
  // written so an opaque base gives exactly 1, not 0.9999…
  const alpha = 1 - (1 - at) * (1 - ab);
  if (alpha === 0) return write({ r: 0, g: 0, b: 0, alpha: 0 }, output, true);
  const ch = (k: "r" | "g" | "b") => (top[k] * at + bottom[k] * ab * (1 - at)) / alpha;
  return write({ r: ch("r"), g: ch("g"), b: ch("b"), alpha }, output, false);
}

/** The colour with its alpha replaced, as `#rrggbbaa`; `{ format: "srgb" }` returns it unrounded. */
export function withAlpha(color: string, alpha: number, output: ColorOutput = {}): string {
  const { r, g, b } = srgb(color);
  return write({ r, g, b, alpha }, output, true);
}

/** A colour's alpha, 0..1, as written (`transparent` is 0, a colour without alpha 1). */
export function alphaOf(color: string): number {
  return parseOrThrow(color).alpha ?? 1;
}
