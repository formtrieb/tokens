/**
 * What a reference-free value means under its token's type. The meaning
 * comes from the type alone, never from how the value was reached: a
 * `fontSizes` token holding `20`, `20px` or a reference to a `20px` dimension
 * means 20px each time.
 */
import { converter, formatHex, formatHex8, parse } from "culori";
import { alignType, fontWeightFor } from "../canonicalize/index.js";
import { mapToSrgbGamut } from "../parser/gamut.js";
import { evaluate } from "./arithmetic.js";
import type { Color, Expr, TokenProblem, TokenValue } from "./types.js";

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const PERCENT = new RegExp(`^(${NUMBER})%$`);
const DURATION = new RegExp(`^(${NUMBER})(ms|s)?$`);
const BEZIER = new RegExp(`^(?:cubic-bezier\\()?\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*,\\s*(${NUMBER})\\s*\\)?$`);
const EASING_KEYWORDS = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\([^)]*\))$/;
const FONT_WEIGHT = /^(\d+)(?:\s+(italic|oblique))?$/;

/** The composite types and the type each of their properties is read with. */
export const COMPOSITE_PROPERTIES: Record<string, Record<string, string>> = {
  typography: {
    fontFamily: "fontFamilies",
    fontWeight: "fontWeights",
    fontSize: "fontSizes",
    lineHeight: "lineHeights",
    letterSpacing: "letterSpacing",
    paragraphSpacing: "paragraphSpacing",
    paragraphIndent: "paragraphIndent",
    textCase: "textCase",
    textDecoration: "textDecoration",
  },
  shadow: { offsetX: "dimension", offsetY: "dimension", blur: "dimension", spread: "dimension", color: "color" },
  border: { width: "borderWidth", style: "strokeStyle", color: "color" },
  transition: { duration: "duration", delay: "duration", timingFunction: "cubicBezier" },
};

/** Tokens Studio writes shadow offsets as `x` / `y`. */
export const SHADOW_ALIASES: Record<string, string> = { x: "offsetX", y: "offsetY" };

export type Report = (problem: TokenProblem) => void;

const asColor = (c: unknown): Color => c as Color;

const toRgb = converter("rgb");
const GAMUT_EPSILON = 1e-6;

/**
 * Whether a colour lies outside sRGB. A conversion leaves white at
 * r 1.0000001; that is float noise, not a colour outside.
 */
export function isOutOfGamut(color: Color): boolean {
  const { r, g, b } = toRgb(color);
  return [r, g, b].some((v: number) => v < -GAMUT_EPSILON || v > 1 + GAMUT_EPSILON);
}

/**
 * A colour as written. Anything culori reads, and Tokens Studio's
 * `rgba(<colour>, <alpha>)`, which sets the alpha of any colour.
 */
export function readColor(text: string): TokenValue {
  const literal = text.trim();
  let color = parse(literal);
  if (!color) {
    const m = literal.match(/^rgba?\(\s*(.+?)\s*,\s*([^,()]+?)\s*\)$/);
    const base = m && Number.isNaN(Number(m[1])) ? parse(m[1]) : undefined;
    if (base) {
      const pct = m![2].match(PERCENT);
      const alpha = pct ? Number(pct[1]) / 100 : Number(m![2]);
      if (!Number.isNaN(alpha)) color = { ...base, alpha: Math.max(0, Math.min(1, alpha)) };
    }
  }
  if (!color) return { kind: "color", literal };
  return { kind: "color", literal, color: asColor(color), outOfGamut: isOutOfGamut(asColor(color)) };
}

/** The colour as text: as written when it was written, else 8-bit hex (with alpha when translucent). */
export function colorText(value: Extract<TokenValue, { kind: "color" }>): string {
  if (value.literal !== undefined) return value.literal;
  if (!value.color) return "";
  const mapped = mapToSrgbGamut(value.color);
  return (mapped.alpha ?? 1) < 1 ? formatHex8(mapped) : formatHex(mapped);
}

function exprText(e: Expr): string {
  if ("op" in e) return `(${exprText(e.left)} ${e.op} ${exprText(e.right)})`;
  return textOf(e);
}

/**
 * A value as text, for a reference embedded in a longer string: a length as
 * `${value}${unit}`, a number unrounded, a colour as written or as hex.
 */
export function textOf(value: TokenValue): string {
  switch (value.kind) {
    case "length":
      return `${value.value}${value.unit}`;
    case "number":
      return `${value.value}`;
    case "color":
      return colorText(value);
    case "fontWeight":
      return value.style ? `${value.value} ${value.style}` : `${value.value}`;
    case "fontFamily":
      return value.families.join(", ");
    case "duration":
      return `${value.value}${value.unit}`;
    case "cubicBezier":
      return `cubic-bezier(${value.points.join(", ")})`;
    case "string":
      return value.value;
    case "list":
      return value.items.map(textOf).join(" ");
    case "expression":
      return exprText(value.expr).replace(/^\((.*)\)$/, "$1");
    case "unresolved":
      return value.text;
    case "raw":
      return typeof value.value === "string" ? value.value : JSON.stringify(value.value);
    default:
      return JSON.stringify(value);
  }
}

/** A bare number in a length type is px, in a list and as a whole. */
function px(value: TokenValue): TokenValue {
  if (value.kind === "number") return { kind: "length", value: value.value, unit: "px" };
  if (value.kind === "list") return { kind: "list", items: value.items.map(px) };
  return value;
}

const text = (raw: string | number) => `${raw}`.trim();

/** Aligned types whose value is a length. */
const LENGTH_TYPES = new Set(["dimension", "fontSize", "lineHeight"]);

const isDtcgQuantity = (v: unknown): v is { value: number; unit: string } =>
  typeof v === "object" && v !== null && !Array.isArray(v) &&
  typeof (v as { value?: unknown }).value === "number" && typeof (v as { unit?: unknown }).unit === "string";

function fontFamilies(raw: unknown): TokenValue {
  const list = (Array.isArray(raw) ? raw.map(String) : [`${raw}`]).flatMap((f) => f.split(","));
  const families = list.map((f) => f.trim().replace(/^(['"])(.*)\1$/, "$2")).filter((f) => f !== "");
  return { kind: "fontFamily", families };
}

/**
 * A reference-free scalar under a Tokens Studio type. Composites and
 * references are the resolver's; this reads what remains. `type` undefined:
 * a number is a number, text is a string, anything else raw.
 */
export function readScalar(raw: unknown, type: string | undefined, path: string, report: Report): TokenValue {
  const aligned = alignType(type);
  const invalid = (reason: string): TokenValue => {
    report({ kind: "invalid-value", path, type: type!, value: raw, reason });
    return { kind: "string", value: typeof raw === "string" ? raw : JSON.stringify(raw) };
  };

  if (aligned === "fontFamily" && (typeof raw === "string" || Array.isArray(raw))) return fontFamilies(raw);
  if (aligned === "cubicBezier" && Array.isArray(raw)) {
    if (raw.length === 4 && raw.every((n) => typeof n === "number" || (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))))) {
      return { kind: "cubicBezier", points: raw.map(Number) as [number, number, number, number] };
    }
    return invalid("cubic-bezier needs four numbers");
  }
  if (isDtcgQuantity(raw)) {
    // DTCG writes a dimension or a duration as `{ value, unit }`.
    if (aligned === "duration" && (raw.unit === "ms" || raw.unit === "s")) return { kind: "duration", value: raw.value, unit: raw.unit };
    if (aligned !== undefined && LENGTH_TYPES.has(aligned)) return { kind: "length", value: raw.value, unit: raw.unit };
  }
  if (typeof raw !== "string" && typeof raw !== "number") return { kind: "raw", value: raw };
  if (type === undefined) return typeof raw === "number" ? { kind: "number", value: raw } : { kind: "string", value: raw };

  const t = text(raw);
  const percent = t.match(PERCENT);

  if (type === "letterSpacing" && percent) return { kind: "length", value: Number(percent[1]) / 100, unit: "em" };

  switch (aligned) {
    case "dimension":
    case "fontSize":
      return px(evaluate(t) ?? { kind: "string", value: t });
    case "lineHeight":
    case "opacity":
      if (percent) return { kind: "number", value: Number(percent[1]) / 100 };
      return evaluate(t) ?? { kind: "string", value: t };
    case "number": {
      const v = evaluate(t);
      return v?.kind === "number" ? v : { kind: "string", value: t };
    }
    case "fontWeight": {
      const mapped = `${fontWeightFor(t, "fontWeight")}`;
      const m = mapped.match(FONT_WEIGHT);
      if (!m) return invalid("unknown font weight");
      return { kind: "fontWeight", value: Number(m[1]), ...(m[2] && { style: m[2] as "italic" | "oblique" }) };
    }
    case "duration": {
      const m = t.match(DURATION);
      if (!m) return invalid("duration needs a number in ms or s");
      return { kind: "duration", value: Number(m[1]), unit: (m[2] ?? "ms") as "ms" | "s" };
    }
    case "cubicBezier": {
      if (EASING_KEYWORDS.test(t)) return { kind: "string", value: t };
      const m = t.match(BEZIER);
      if (!m) return invalid("cubic-bezier needs four numbers");
      return { kind: "cubicBezier", points: [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] };
    }
    case "color":
      return readColor(t);
    default:
      return typeof raw === "number" ? { kind: "number", value: raw } : { kind: "string", value: raw };
  }
}
