import {
  parse,
  formatHex,
  formatHex8,
  formatRgb,
  displayable,
  converter,
  interpolate,
} from "culori";
import { mapToSrgbGamut } from "./gamut.js";
import {
  lightenLch,
  darkenLch,
  lightenHsl,
  darkenHsl,
  lightenChannels,
  darkenChannels,
} from "./color-modifiers.js";
import type { ColorModifier } from "../types.js";

const toLch = converter("lch");
const toHsl = converter("hsl");
const toRgb = converter("rgb");
const toP3 = converter("p3");

/**
 * What `applyColorModifier` returns.
 * - `hex`: 8-bit `#rrggbb`, or `rgba(r, g, b, a)` when transparent — what
 *   tokens-mcp reports.
 * - `srgb`: unquantised `rgb(r% g% b% / a)` at five significant digits — what
 *   the resolver ships, in the shape sd-transforms' `format: 'srgb'` wrote.
 */
export type ModifierOutput = "hex" | "srgb";

export type ColorFormat = "rgba" | "hex8" | "hex";

/**
 * Render a resolved colour value in a chosen format. Lets callers normalize a
 * mix of `#hex` (plain + lighten/darken results) and `rgba(...)` (alpha results)
 * into one consistent representation. Non-colour values (dimensions, numbers,
 * unresolved references) pass through untouched.
 */
export function formatColor<T>(value: T, format: ColorFormat): T | string {
  if (typeof value !== "string") return value;
  const parsed = parse(value);
  if (!parsed) return value;
  // Route through the sole gamut-mapping decision (see gamut.ts) before
  // formatting, same as every other exported colour path. For an
  // already-resolved in-gamut value — what @formtrieb/tokens-mcp passes in —
  // this is an identity operation.
  const mapped = mapToSrgbGamut(parsed);
  switch (format) {
    case "rgba":
      return formatRgb(mapped);
    case "hex8":
      return formatHex8(mapped);
    case "hex":
      return formatHex(mapped);
    default:
      return value;
  }
}

/**
 * Render a gamut-mapped colour, keeping the alpha channel when there is one.
 * `formatHex` silently drops alpha, which loses it for any modifier applied on
 * top of an already-transparent base. The `rgba(...)` shape matches what the
 * `alpha` branch already returns.
 */
function formatResolved(color: any): string {
  const alpha = color.alpha ?? 1;
  if (alpha >= 1) return formatHex(color);
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveLchToHex(value: string): string | null {
  const color = parse(value);
  if (!color) return null;
  return formatHex(mapToSrgbGamut(color));
}

export function resolveLchToHexWithGamut(value: string): { hex: string; clipped: boolean } | null {
  const color = parse(value);
  if (!color) return null;
  // `clipped` keeps its name and meaning — "this colour did not fit sRGB and was
  // adjusted". The adjustment is now a chroma-reducing gamut map rather than a
  // per-channel clip, which is what the shipped CSS does.
  const clipped = !displayable(color);
  return { hex: formatHex(mapToSrgbGamut(color)), clipped };
}

export function applyColorModifier(
  baseColor: string,
  modifier: Pick<ColorModifier, "value" | "space" | "color"> & { type: string },
  output: ModifierOutput = "hex"
): string | null {
  const parsed = parse(baseColor);
  if (!parsed) return null;
  const amount = parseFloat(modifier.value);

  if (modifier.type === "alpha") {
    if (isNaN(amount)) return null;
    // Match sd-transforms' `transparentize`, which clamps to [0, 1]
    // (`Math.max(0, Math.min(1, Number(amount)))`) rather than passing the
    // parsed amount through raw.
    const alpha = Math.max(0, Math.min(1, amount));
    if (output === "srgb") return formatSrgb({ ...parsed, alpha });
    // Gamut-map before reading channels: an out-of-gamut base would otherwise
    // yield r/g/b outside [0,1] and round past 255.
    const inGamut = mapToSrgbGamut(parsed);
    const r = Math.round((inGamut.r ?? 0) * 255);
    const g = Math.round((inGamut.g ?? 0) * 255);
    const b = Math.round((inGamut.b ?? 0) * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const modified = isNaN(amount) ? parsed : modifyColor(parsed, modifier, amount);
  return output === "srgb"
    ? formatSrgb(modified)
    : formatResolved(mapToSrgbGamut(modified));
}

/**
 * lighten / darken / mix in the modifier's space, formula for formula as
 * sd-transforms has them (see color-modifiers.ts). A space sd-transforms does
 * not know falls back to lch, which is what this package always did.
 */
function modifyColor(
  color: any,
  modifier: Pick<ColorModifier, "space" | "color"> & { type: string },
  amount: number
): any {
  switch (modifier.type) {
    case "lighten":
    case "darken": {
      const lighten = modifier.type === "lighten";
      switch (modifier.space) {
        case "hsl":
          return (lighten ? lightenHsl : darkenHsl)(toHsl(color) as any, amount);
        case "srgb":
          return (lighten ? lightenChannels : darkenChannels)(toRgb(color) as any, amount);
        case "p3":
          return (lighten ? lightenChannels : darkenChannels)(toP3(color) as any, amount);
        default:
          return (lighten ? lightenLch : darkenLch)(toLch(color) as any, amount);
      }
    }
    case "mix": {
      const target = modifier.color ? parse(modifier.color) : undefined;
      const mode = MIX_MODES[modifier.space];
      // sd-transforms falls back to the base when it cannot mix.
      if (!target || !mode) return color;
      const t = Math.max(0, Math.min(1, amount));
      // colorjs.io serialises the mix in its space at five significant digits
      // and parses it back before converting on; do the same rounding.
      return roundInSpace(interpolate([color, target], mode)(t), mode);
    }
    default:
      return color;
  }
}

const MIX_MODES: Record<string, "lch" | "hsl" | "rgb" | "p3"> = {
  lch: "lch",
  hsl: "hsl",
  srgb: "rgb",
  p3: "p3",
};

/** colorjs.io's coordinate scale per space: percentages where it prints them. */
const PERCENT_COORDS: Record<string, string[]> = { rgb: ["r", "g", "b"], hsl: ["s", "l"] };

function roundInSpace(color: any, mode: string): any {
  const out = { ...color };
  for (const key of ["r", "g", "b", "l", "c", "h", "s"]) {
    if (typeof out[key] !== "number") continue;
    const scale = PERCENT_COORDS[mode]?.includes(key) ? 100 : 1;
    out[key] = toPrecision(out[key] * scale, 5) / scale;
  }
  return out;
}

/**
 * colorjs.io's `toPrecision`: round to `precision` significant digits of the
 * integer part plus fraction, the rule its `toString()` applies per coordinate.
 */
function toPrecision(n: number, precision: number): number {
  if (n === 0) return 0;
  const integer = ~~n;
  const digits = integer ? ~~Math.log10(Math.abs(integer)) + 1 : 0;
  const multiplier = 10 ** (precision - digits);
  return Math.floor(n * multiplier + 0.5) / multiplier;
}

/** Gamut-mapped `rgb(r% g% b%[ / a])`, five significant digits per channel. */
function formatSrgb(color: any): string {
  const rgb = mapToSrgbGamut(toRgb(color)) as any;
  const channels = [rgb.r, rgb.g, rgb.b]
    .map((v: number) => `${toPrecision((v ?? 0) * 100, 5)}%`)
    .join(" ");
  const alpha = rgb.alpha ?? 1;
  return alpha >= 1 ? `rgb(${channels})` : `rgb(${channels} / ${toPrecision(alpha, 5)})`;
}

export function isLchFormula(value: string): boolean {
  return typeof value === "string" && /^lch\s*\(/i.test(value.trim());
}

export function isInSrgbGamut(hexOrColor: string): boolean {
  const color = parse(hexOrColor);
  if (!color) return true; // Can't check → assume fine
  return displayable(color);
}

export function isPlainColor(value: string): boolean {
  if (typeof value !== "string") return false;
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ||
    /^rgba?\s*\(/.test(value.trim())
  );
}
