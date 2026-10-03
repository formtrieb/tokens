import {
  parse,
  formatHex,
  formatHex8,
  formatRgb,
  displayable,
  converter,
} from "culori";
import { mapToSrgbGamut } from "./gamut.js";
import { lightenLch, darkenLch } from "./color-modifiers.js";

const toLch = converter("lch");

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
  modifier: { type: string; value: string; space: string }
): string | null {
  const parsed = parse(baseColor);
  if (!parsed) return null;

  switch (modifier.type) {
    case "alpha": {
      const rawAlpha = parseFloat(modifier.value);
      if (isNaN(rawAlpha)) return null;
      // Match sd-transforms' `transparentize`, which clamps to [0, 1]
      // (`Math.max(0, Math.min(1, Number(amount)))`) rather than passing the
      // parsed amount through raw.
      const alpha = Math.max(0, Math.min(1, rawAlpha));
      // Gamut-map before reading channels: an out-of-gamut base would otherwise
      // yield r/g/b outside [0,1] and round past 255.
      const inGamut = mapToSrgbGamut(parsed);
      const r = Math.round((inGamut.r ?? 0) * 255);
      const g = Math.round((inGamut.g ?? 0) * 255);
      const b = Math.round((inGamut.b ?? 0) * 255);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    case "lighten": {
      const amount = parseFloat(modifier.value);
      if (isNaN(amount)) return formatResolved(mapToSrgbGamut(parsed));
      return formatResolved(mapToSrgbGamut(lightenLch(toLch(parsed), amount)));
    }
    case "darken": {
      const amount = parseFloat(modifier.value);
      if (isNaN(amount)) return formatResolved(mapToSrgbGamut(parsed));
      return formatResolved(mapToSrgbGamut(darkenLch(toLch(parsed), amount)));
    }
    default:
      return formatResolved(mapToSrgbGamut(parsed));
  }
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
