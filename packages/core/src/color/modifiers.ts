/**
 * Tokens Studio's colour modifiers (`$extensions["studio.tokens"].modify`).
 *
 * lighten and darken reduce chroma proportionally to the amount and move
 * lightness by a fraction of the *remaining distance* to the endpoint, not by
 * an absolute step. These are the formulas Tokens Studio's own tooling uses;
 * `test/color/modifiers.test.ts` holds its results as fixed values.
 */
import { converter, interpolate, parse } from "culori";
import { isOutOfGamut, mapToSrgbGamut } from "./gamut.js";
import { toPrecision } from "./css.js";
import type { Color } from "../system/types.js";

const toLch = converter("lch");
const toHsl = converter("hsl");
const toRgb = converter("rgb");
const toP3 = converter("p3");

export interface LchColor {
  mode: string;
  l: number;
  c: number;
  h?: number;
}

export function lightenLch(color: LchColor, amount: number): LchColor {
  return {
    ...color,
    l: Math.min(100, color.l + (100 - color.l) * amount),
    c: Math.max(0, color.c - amount * color.c),
  };
}

export function darkenLch(color: LchColor, amount: number): LchColor {
  return {
    ...color,
    l: Math.max(0, color.l - color.l * amount),
    c: Math.max(0, color.c - amount * color.c),
  };
}

/**
 * The other spaces Tokens Studio knows. hsl moves lightness like lch does
 * (without touching saturation); srgb and p3 move every channel by the same
 * fraction of its distance to 1 (lighten) or 0 (darken).
 */
type Channels = { r: number; g: number; b: number };

export function lightenChannels<T extends Channels>(color: T, amount: number): T {
  const up = (v: number) => Math.min(1, v + amount * (1 - v));
  return { ...color, r: up(color.r), g: up(color.g), b: up(color.b) };
}

export function darkenChannels<T extends Channels>(color: T, amount: number): T {
  const down = (v: number) => Math.max(0, v - amount * v);
  return { ...color, r: down(color.r), g: down(color.g), b: down(color.b) };
}

export function lightenHsl<T extends { l: number }>(color: T, amount: number): T {
  return { ...color, l: Math.min(1, color.l + (1 - color.l) * amount) };
}

export function darkenHsl<T extends { l: number }>(color: T, amount: number): T {
  return { ...color, l: Math.max(0, color.l - color.l * amount) };
}

const MIX_MODES: Record<string, "lch" | "hsl" | "rgb" | "p3"> = { lch: "lch", hsl: "hsl", srgb: "rgb", p3: "p3" };

/** colorjs.io's coordinate scale per space: percentages where it prints them. */
const PERCENT_COORDS: Record<string, string[]> = { rgb: ["r", "g", "b"], hsl: ["s", "l"] };

/** A mix as Tokens Studio computes it: serialised in its space at five significant digits, read back. */
function roundInSpace(color: any, mode: string): any {
  const out = { ...color };
  for (const key of ["r", "g", "b", "l", "c", "h", "s"]) {
    if (typeof out[key] !== "number") continue;
    const scale = PERCENT_COORDS[mode]?.includes(key) ? 100 : 1;
    out[key] = toPrecision(out[key] * scale, 5) / scale;
  }
  return out;
}

export interface ColorModifierSpec {
  type: "lighten" | "darken" | "alpha" | "mix" | string;
  /** The amount, 0..1. */
  amount: number;
  /** `lch` (default), `hsl`, `srgb` or `p3`. */
  space?: string;
  /** The colour to mix towards; only read by `mix`. */
  color?: Color | string;
}

/**
 * A colour with a Tokens Studio modifier applied. The result is unrounded and
 * not gamut-mapped.
 *
 * Rule: a modifier works on the colour the base shows, so a base outside
 * sRGB is gamut-mapped first. The result then does not depend on how the base
 * was reached (written as `lch()` or computed by a modifier of its own).
 * `alpha` sets the alpha (clamped to 0..1); an unknown type or space leaves
 * the colour as it is (an unknown space reads as `lch`).
 */
export function modifyColor(color: Color, modifier: ColorModifierSpec): Color {
  const base: any = isOutOfGamut(color) ? mapToSrgbGamut(color) : color;
  const { type, amount } = modifier;
  const space = modifier.space ?? "lch";
  if (Number.isNaN(amount)) return base;
  switch (type) {
    case "alpha":
      return { ...base, alpha: Math.max(0, Math.min(1, amount)) };
    case "lighten":
    case "darken": {
      const lighten = type === "lighten";
      switch (space) {
        case "hsl":
          return (lighten ? lightenHsl : darkenHsl)(toHsl(base) as any, amount);
        case "srgb":
          return (lighten ? lightenChannels : darkenChannels)(toRgb(base) as any, amount);
        case "p3":
          return (lighten ? lightenChannels : darkenChannels)(toP3(base) as any, amount);
        default:
          return (lighten ? lightenLch : darkenLch)(toLch(base) as any, amount) as unknown as Color;
      }
    }
    case "mix": {
      const target = typeof modifier.color === "string" ? parse(modifier.color) : modifier.color;
      const mode = MIX_MODES[space];
      if (!target || !mode) return base;
      const t = Math.max(0, Math.min(1, amount));
      return roundInSpace(interpolate([base, target], mode)(t), mode);
    }
    default:
      return base;
  }
}
