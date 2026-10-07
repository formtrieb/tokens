import { parse } from "culori";
import type { Color } from "../system/types.js";

const PERCENT = /^([-+]?(?:\d+\.?\d*|\.\d+))%$/;

/**
 * A colour from text: anything culori reads, and Tokens Studio's
 * `rgba(<colour>, <alpha>)`, which sets the alpha of any colour. Undefined
 * for text that is no colour (or one culori does not know: gradients,
 * system colours).
 */
export function parseColor(text: string): Color | undefined {
  const literal = text.trim();
  const direct = parse(literal);
  if (direct) return direct as Color;
  const m = literal.match(/^rgba?\(\s*(.+?)\s*,\s*([^,()]+?)\s*\)$/);
  const base = m && Number.isNaN(Number(m[1])) ? parse(m[1]!) : undefined;
  if (!base) return undefined;
  const pct = m![2]!.match(PERCENT);
  const alpha = pct ? Number(pct[1]) / 100 : Number(m![2]);
  return Number.isNaN(alpha) ? undefined : ({ ...base, alpha: Math.max(0, Math.min(1, alpha)) } as Color);
}
