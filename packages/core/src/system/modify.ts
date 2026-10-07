import { modifyColor } from "../color/modifiers.js";
import { isOutOfGamut } from "../color/gamut.js";
import type { TokenValue } from "./types.js";

/**
 * A resolved modifier on a resolved value (see `modifyColor` for the rule).
 * The result is computed, so it has no literal. A value that is no readable
 * colour, or an amount that is no number, is left as it is.
 */
export function applyModifier(
  value: TokenValue,
  modify: { type: string; space: string; value: TokenValue; color?: TokenValue }
): TokenValue {
  if (value.kind !== "color" || !value.color) return value;
  const amount = modify.value.kind === "number" ? modify.value.value : Number.NaN;
  if (Number.isNaN(amount)) return value;
  const target = modify.color?.kind === "color" ? modify.color.color : undefined;
  const color = modifyColor(value.color, { type: modify.type, space: modify.space, amount, ...(target && { color: target }) });
  return { kind: "color", color, outOfGamut: isOutOfGamut(color) };
}
