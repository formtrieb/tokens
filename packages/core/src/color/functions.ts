import { converter, differenceCiede2000, differenceEuclidean, displayable, wcagContrast } from "culori";
import { cssColor } from "./css.js";
import { toSrgb } from "./gamut.js";
import { parseColor } from "./parse.js";
import type { Color } from "../system/types.js";

/**
 * General colour functions for code that generates or checks colours: convert
 * between OKLCH and hex, measure contrast and distance, layer colours.
 *
 * Every argument named `color` is any CSS colour string `parseColor` reads
 * (hex, `rgb()`, `oklch()`, Tokens Studio's `rgba(<colour>, a)`, …). An
 * unreadable string throws — a measurement of "not a colour" has no
 * meaningful number.
 */

const toOklch = converter("oklch");
const ciede2000 = differenceCiede2000();
const euclideanOklab = differenceEuclidean("oklab");

function read(color: string): Color {
  const parsed = typeof color === "string" ? parseColor(color) : undefined;
  if (!parsed) throw new TypeError(`Not a colour: ${String(color)}`);
  return parsed;
}

/** OKLCH → `#rrggbb`, gamut-mapped into sRGB when outside. */
export function oklchToHex(l: number, c: number, h: number): string {
  return cssColor({ mode: "oklch", l, c, h }, "hex");
}

/** Any colour → OKLCH: lightness 0..1, chroma 0 and up, hue in degrees (undefined when achromatic). */
export function hexToOklch(color: string): { l: number; c: number; h: number | undefined } {
  const { l, c, h } = toOklch(read(color));
  return { l, c: c ?? 0, h };
}

/** WCAG 2 contrast ratio, 1..21. Symmetric. */
export function contrastWcag(a: string, b: string): number {
  return wcagContrast(read(a), read(b));
}

/** CIEDE2000 colour difference. */
export function deltaE2000(a: string, b: string): number {
  return ciede2000(read(a), read(b));
}

/** Euclidean distance in OKLab, in OKLab units (a just-noticeable difference is about 0.02). */
export function deltaEOK(a: string, b: string): number {
  return euclideanOklab(read(a), read(b));
}

/** `"hex"` (default): `#rrggbb`, `#rrggbbaa` when translucent. `"srgb"`: `color(srgb r g b / a)` unrounded. */
type Output = { format?: "hex" | "srgb" };

/**
 * Source-over compositing of `layer` onto `base` in sRGB, the way a browser
 * paints a translucent colour over another.
 */
export function over(layer: string, base: string, output: Output = {}): string {
  const top = toSrgb(read(layer));
  const bottom = toSrgb(read(base));
  const at = top.alpha ?? 1;
  const ab = bottom.alpha ?? 1;
  // written so an opaque base gives exactly 1, not 0.9999…
  const alpha = 1 - (1 - at) * (1 - ab);
  if (alpha === 0) return cssColor({ mode: "rgb", r: 0, g: 0, b: 0, alpha: 0 }, output.format ?? "hex");
  const ch = (k: "r" | "g" | "b") => (top[k] * at + bottom[k] * ab * (1 - at)) / alpha;
  return cssColor({ mode: "rgb", r: ch("r"), g: ch("g"), b: ch("b"), alpha }, output.format ?? "hex");
}

/** The colour with its alpha replaced. */
export function withAlpha(color: string, alpha: number, output: Output = {}): string {
  const { r, g, b } = toSrgb(read(color));
  return cssColor({ mode: "rgb", r, g, b, alpha }, output.format ?? "hex");
}

/** A colour's alpha, 0..1, as written (`transparent` is 0, a colour without alpha 1). */
export function alphaOf(color: string): number {
  return read(color).alpha ?? 1;
}

/** Whether a colour lies inside sRGB. Text that is no colour counts as inside. */
export function isInSrgbGamut(color: string): boolean {
  const parsed = parseColor(color);
  return parsed ? displayable(parsed) : true;
}
