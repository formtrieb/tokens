import { formatHex, formatHex8 } from "culori";
import { toSrgb } from "./gamut.js";
import type { Color } from "../system/types.js";

/**
 * colorjs.io's `toPrecision`: round to `precision` significant digits of the
 * integer part plus fraction, the rule its `toString()` applies per coordinate.
 */
export function toPrecision(n: number, precision: number): number {
  if (n === 0) return 0;
  const integer = ~~n;
  const digits = integer ? ~~Math.log10(Math.abs(integer)) + 1 : 0;
  const multiplier = 10 ** (precision - digits);
  return Math.floor(n * multiplier + 0.5) / multiplier;
}

/**
 * A colour in one CSS form, in sRGB (gamut-mapped when outside). Alpha is
 * written only when it is below 1.
 * - `rgb`: `rgb(r, g, b)` / `rgba(r, g, b, a)`, 8-bit channels, alpha to two digits
 * - `hex`: `#rrggbb` / `#rrggbbaa`
 * - `percent`: `rgb(r% g% b% / a)`, five significant digits
 * - `srgb`: `color(srgb r g b / a)` at full precision, for code that chains steps and measures
 */
export function cssColor(color: Color, form: "rgb" | "hex" | "percent" | "srgb"): string {
  const c = toSrgb(color);
  const alpha = c.alpha ?? 1;
  switch (form) {
    case "hex":
      return alpha < 1 ? formatHex8(c) : formatHex(c);
    case "srgb":
      return `color(srgb ${c.r} ${c.g} ${c.b}${alpha < 1 ? ` / ${alpha}` : ""})`;
    case "percent": {
      const channels = [c.r, c.g, c.b].map((v) => `${toPrecision(v * 100, 5)}%`).join(" ");
      return alpha < 1 ? `rgb(${channels} / ${toPrecision(alpha, 5)})` : `rgb(${channels})`;
    }
    case "rgb": {
      const [r, g, b] = [c.r, c.g, c.b].map((v) => Math.round(v * 255));
      return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})` : `rgb(${r}, ${g}, ${b})`;
    }
  }
}
