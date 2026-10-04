/**
 * `canonicalize`: what a resolved Tokens-Studio value means, independent of
 * any output format. One place knows that a `150%` line height is 1.5, that
 * `-5%` letter-spacing is `-0.05em`, that `Bold` is 700 and that a bare `8`
 * is 8px.
 *
 * The rules are those of `@tokens-studio/sd-transforms` 2 (`ts/resolveMath`,
 * `ts/size/px`, `ts/opacity`, `ts/size/lineheight`,
 * `ts/typography/fontWeight`, `ts/size/css/letterspacing`), formula for
 * formula, because the CSS shipped so far was computed by them. Values stay
 * in the same shape sd-transforms leaves them in (strings with units,
 * numbers, composite objects), so a renderer can reproduce today's output
 * byte for byte. Colour is `applyColorModifier` / `formatColor`.
 *
 * Additive: `ReferenceResolver` and the MCP keep returning raw `finalValue`.
 */
import { resolveMath } from "./math.js";

export { resolveMath, parseAndReduce } from "./math.js";

/**
 * Tokens Studio type → the type the sd-transforms rules key on. A
 * `letterSpacing` becomes `dimension`; its origin is kept by passing the
 * Tokens Studio type alongside.
 */
const ALIGNED_TYPES: Record<string, string> = {
  fontFamilies: "fontFamily",
  fontWeights: "fontWeight",
  fontSizes: "fontSize",
  lineHeights: "lineHeight",
  boxShadow: "shadow",
  spacing: "dimension",
  sizing: "dimension",
  borderRadius: "dimension",
  borderWidth: "dimension",
  letterSpacing: "dimension",
  paragraphSpacing: "dimension",
  paragraphIndent: "dimension",
  text: "content",
};

export function alignType(type: string | undefined): string | undefined {
  return type === undefined ? undefined : (ALIGNED_TYPES[type] ?? type);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function percentageToDecimal(value: unknown): unknown {
  if (!`${value}`.endsWith("%")) return value;
  return parseFloat(`${value}`.slice(0, -1)) / 100;
}

// ── single steps; `type` is the aligned type ──────────────────────────────

/** `ts/resolveMath`: every string expression reduced, per property for composites. */
export function evaluateMathFor(value: unknown, type: string | undefined): unknown {
  const each = (v: Obj): Obj => {
    for (const k of Object.keys(v)) v[k] = resolveMath(v[k]);
    return v;
  };
  if (type === "typography" || type === "border") return isObj(value) ? each(value) : value;
  if (type === "shadow") {
    if (Array.isArray(value)) return value.map((s) => (isObj(s) ? each(s) : s));
    return isObj(value) ? each(value) : value;
  }
  return resolveMath(value);
}

function ensurePx(dim: string): string {
  return !isNaN(dim as unknown as number) && dim !== "" && parseFloat(dim) !== 0 ? `${dim}px` : `${dim}`;
}

function pxValue(value: unknown): string {
  const parts = typeof value === "string" && value.includes(" ") ? value.split(" ") : [`${value}`];
  return parts.map(ensurePx).join(" ");
}

const PX_TYPES = ["fontSize", "dimension", "typography", "border", "shadow"];

/** `ts/size/px`: a bare number is px. */
export function pxFor(value: unknown, type: string | undefined): unknown {
  if (!type || !PX_TYPES.includes(type) || value === undefined) return value;
  const prop = (v: Obj, key: string) => {
    if (v[key] !== undefined) v[key] = pxValue(v[key]);
  };
  switch (type) {
    case "typography":
      if (isObj(value)) prop(value, "fontSize");
      return value;
    case "shadow": {
      const one = (s: unknown) => {
        if (isObj(s)) for (const k of ["offsetX", "offsetY", "blur", "spread"]) prop(s, k);
        return s;
      };
      return Array.isArray(value) ? value.map(one) : one(value);
    }
    case "border":
      if (isObj(value)) prop(value, "width");
      return value;
    default:
      return pxValue(value);
  }
}

/** `ts/opacity`: `8%` → 0.08. */
export function opacityFor(value: unknown, type: string | undefined): unknown {
  if (type !== "opacity" || value === undefined) return value;
  const d = percentageToDecimal(value);
  return typeof d === "string" || (typeof d === "number" && isNaN(d)) ? value : d;
}

/** `ts/size/lineheight`: `150%` → 1.5. */
export function lineHeightFor(value: unknown, type: string | undefined): unknown {
  if ((type !== "lineHeight" && type !== "typography") || value === undefined) return value;
  const lh = (v: unknown) => {
    const d = percentageToDecimal(v);
    return typeof d === "string" || (typeof d === "number" && isNaN(d)) ? `${v}` : d;
  };
  if (type === "typography") {
    return isObj(value) && value.lineHeight !== undefined ? { ...value, lineHeight: lh(value.lineHeight) } : value;
  }
  return lh(value);
}

const FONT_WEIGHTS: Record<string, number> = {
  hairline: 100, thin: 100,
  extralight: 200, ultralight: 200, extraleicht: 200,
  light: 300, leicht: 300,
  normal: 400, regular: 400, buch: 400, book: 400,
  medium: 500, kraeftig: 500, kräftig: 500,
  semibold: 600, demibold: 600, halbfett: 600,
  bold: 700, dreiviertelfett: 700,
  extrabold: 800, ultrabold: 800, fett: 800,
  black: 900, heavy: 900, super: 900, extrafett: 900,
  ultra: 950, ultrablack: 950, extrablack: 950,
};
const FONT_STYLES = ["italic", "oblique", "normal"];
const FONT_WEIGHT_RE = new RegExp(`(?<weight>.+?)\\s?(?<style>${FONT_STYLES.join("|")})?$`, "i");

function weight(fontWeight: unknown): unknown {
  const match = `${fontWeight}`.match(FONT_WEIGHT_RE);
  if (!match?.groups) return fontWeight;
  const w = match.groups.weight.toLowerCase();
  const style = match.groups.style?.toLowerCase() ?? "";
  if (!style && !FONT_WEIGHTS[w] && FONT_STYLES.includes(w)) return w;
  let mapped: unknown = FONT_WEIGHTS[w.replace(/\s/g, "")] ?? w;
  if (w && style) mapped = `${mapped} ${style}`;
  return mapped;
}

/** `ts/typography/fontWeight`: `Bold` → 700, `Bold Italic` → `700 italic`. */
export function fontWeightFor(value: unknown, type: string | undefined): unknown {
  if ((type !== "fontWeight" && type !== "typography") || value === undefined) return value;
  if (type === "typography") {
    return isObj(value) && value.fontWeight !== undefined ? { ...value, fontWeight: weight(value.fontWeight) } : value;
  }
  return weight(value);
}

/** `ts/size/css/letterspacing`: `-5%` → `-0.05em`. `originalType` is the Tokens Studio type. */
export function letterSpacingFor(value: unknown, type: string | undefined, originalType?: string): unknown {
  const applies = type === "letterSpacing" || type === "typography" || originalType === "letterSpacing";
  if (!applies || value === undefined) return value;
  const ls = (v: unknown) => {
    const d = percentageToDecimal(v);
    return typeof d === "string" || (typeof d === "number" && isNaN(d)) ? `${v}` : `${d}em`;
  };
  if (type === "typography") {
    return isObj(value) && value.letterSpacing !== undefined ? { ...value, letterSpacing: ls(value.letterSpacing) } : value;
  }
  return ls(value);
}

/**
 * All meaning steps for a resolved value, in sd-transforms' order. `type` is
 * the Tokens Studio `$type` (`fontSizes`, `letterSpacing`, `typography`, …).
 * Composite values are copied, never mutated.
 */
export function canonicalize(value: unknown, type: string | undefined): unknown {
  const aligned = alignType(type);
  let v = structuredClone(value);
  v = evaluateMathFor(v, aligned);
  v = pxFor(v, aligned);
  v = opacityFor(v, aligned);
  v = lineHeightFor(v, aligned);
  v = fontWeightFor(v, aligned);
  v = letterSpacingFor(v, aligned, type);
  return v;
}
