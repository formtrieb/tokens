import { modifyColor } from "../parser/color-resolver.js";
import { mapToSrgbGamut } from "../parser/gamut.js";
import { isOutOfGamut, textOf } from "./values.js";
import type { Color, TokenValue } from "./types.js";

/**
 * A Tokens Studio colour modifier on a resolved colour, with the colour
 * functions every other colour path of this package uses. The result is
 * computed, so it has no literal; it stays unrounded. A value that is no
 * readable colour, or an amount that is no number, is left as it is.
 *
 * The modifier works on the colour the base shows: a base outside sRGB is
 * gamut-mapped first, as Tokens Studio does. Only the base; a colour without
 * modifier keeps its unmapped value.
 */
export function applyModifier(
  value: TokenValue,
  modify: { type: string; space: string; value: TokenValue; color?: TokenValue }
): TokenValue {
  if (value.kind !== "color" || !value.color) return value;
  const amount = modify.value.kind === "number" ? modify.value.value : Number.NaN;
  if (Number.isNaN(amount)) return value;
  const base = isOutOfGamut(value.color) ? mapToSrgbGamut(value.color) : value.color;
  let color: Color;
  if (modify.type === "alpha") {
    color = { ...base, alpha: Math.max(0, Math.min(1, amount)) };
  } else {
    const target = modify.color ? textOf(modify.color) : undefined;
    color = modifyColor(base, { type: modify.type, space: modify.space, color: target }, amount);
  }
  return { kind: "color", color, outOfGamut: isOutOfGamut(color) };
}
