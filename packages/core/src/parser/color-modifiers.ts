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

/**
 * The other spaces sd-transforms knows. hsl moves lightness like lch does
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
