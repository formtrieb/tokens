/**
 * LCH colour modifier maths, mirroring `@tokens-studio/sd-transforms`
 * (`color-modifiers/lighten.js` and `darken.js`) formula for formula.
 *
 * Both reduce chroma proportionally to the amount, and both move lightness by a
 * fraction of the *remaining distance* to the endpoint — not by an absolute
 * step. An absolute step is what this package did before and is why its values
 * disagreed with the shipped CSS.
 */

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
