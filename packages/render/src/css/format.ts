/**
 * Typed values (core's `TokenValue`) written as CSS, one formatter per kind.
 * Units and colours follow the policy; numbers are rounded to four fraction
 * digits here and nowhere else.
 */
import { alignType, cssColor, type Expr, type TokenValue } from "@formtrieb/tokens-core";
import type { ColorForm, UnitPolicy, UnitPreset } from "../types.js";
import { unitPolicy, unitTarget } from "./units.js";

export interface Format {
  units: UnitPolicy;
  basePxFontSize: number;
  color: ColorForm;
}

/** Where a value sits: the token's path and the type its lengths are looked up under. */
export interface Where {
  path: readonly string[];
  type?: string;
}

/** A position inside a composite: `["fontSize"]`, `[1, "blur"]`. */
export type Position = readonly (string | number)[];

/** A `var(--…)` to write at a composite position instead of the value, or undefined. */
export type AtPosition = (position: Position) => string | undefined;

export type Report = (reason: string) => void;

const FRACTION_DIGITS = 4;

export function num(n: number): string {
  const v = Number(n.toFixed(FRACTION_DIGITS));
  return Object.is(v, -0) ? "0" : `${v}`;
}

const EASING_KEYWORDS = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\([^)]*\))$/;

/** Tokens Studio's `rgba(<colour>, a)` is no CSS; it is written from the parsed colour. */
const STUDIO_RGBA = /^rgba?\(\s*[^\d\s.+-]/i;

/** The types a composite's properties are formatted under, by composite (aligned) type. */
const PROPERTY_TYPES: Record<string, Record<string, string>> = {
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
  border: { width: "borderWidth", style: "strokeStyle", color: "color" },
  transition: { duration: "duration", delay: "duration", timingFunction: "cubicBezier" },
};

/**
 * Whether a term carries a unit: a length leaf does; a sum or difference if
 * either side does; a product if a side does; a quotient if its dividend does.
 */
function unitOf(e: Expr): boolean {
  if (!("op" in e)) return e.kind === "length";
  if (e.op === "/") return unitOf(e.left);
  return unitOf(e.left) || unitOf(e.right);
}

function quoteFont(input: string): string {
  let name = input.trim();
  const quoted = (name.startsWith("'") && name.endsWith("'")) || (name.startsWith('"') && name.endsWith('"'));
  if (!quoted) name = name.replace(/'/g, "\\'");
  return /\s+/.test(name) && !quoted ? `'${name}'` : name;
}

class Formatter {
  constructor(
    private f: Format,
    private report: Report,
    private at: AtPosition
  ) {}

  length(v: Extract<TokenValue, { kind: "length" }>, where: Where): string {
    const target = unitTarget(this.f.units, where.path, where.type, alignType(where.type));
    if (v.unit === "px" && target !== "source") {
      // A zero length needs no unit; under a target it is written as `0`.
      if (v.value === 0) return "0";
      if (target === "rem") return `${num(v.value / this.f.basePxFontSize)}rem`;
    }
    return `${num(v.value)}${v.unit}`;
  }

  color(v: Extract<TokenValue, { kind: "color" }>): string {
    if (!v.color) return v.literal ?? "";
    if (this.f.color === "hex") return cssColor(v.color, "hex");
    if (v.literal === undefined) return cssColor(v.color, "percent");
    if (this.f.color === "rgb" || STUDIO_RGBA.test(v.literal)) return cssColor(v.color, "rgb");
    return v.literal;
  }

  expr(e: Expr, where: Where, parent?: { op: string; right: boolean }): string {
    if (!("op" in e)) return this.value(e, where);
    const [l, r] = [unitOf(e.left), unitOf(e.right)];
    if ((e.op === "*" && l && r) || (e.op === "/" && r)) this.report("arithmetic CSS cannot compute");
    const text = `${this.expr(e.left, where, { op: e.op, right: false })} ${e.op} ${this.expr(e.right, where, { op: e.op, right: true })}`;
    if (!parent) return text;
    const prec = (op: string) => (op === "+" || op === "-" ? 1 : 2);
    const wrap = prec(e.op) < prec(parent.op) || (parent.right && prec(e.op) === prec(parent.op) && (parent.op === "-" || parent.op === "/"));
    return wrap ? `(${text})` : text;
  }

  /** A composite property: its `var()` when the policy says so, else its value under its own type. */
  private prop(value: TokenValue | undefined, position: Position, where: Where): string | undefined {
    const ref = this.at(position);
    if (ref !== undefined) return ref;
    return value === undefined ? undefined : this.value(value, where);
  }

  value(v: TokenValue, where: Where, position: Position = []): string {
    const sub = (_name: string, type: string): Where => ({ path: where.path, type });
    switch (v.kind) {
      case "length":
        return this.length(v, where);
      case "number":
        return num(v.value);
      case "color":
        return this.color(v);
      case "fontWeight":
        return v.style ? `${v.value} ${v.style}` : `${v.value}`;
      case "fontFamily":
        return v.families.map(quoteFont).join(", ");
      case "duration":
        return `${num(v.value)}${v.unit}`;
      case "cubicBezier":
        return `cubic-bezier(${v.points.map(num).join(", ")})`;
      case "string":
        if (alignType(where.type) === "cubicBezier" && !EASING_KEYWORDS.test(v.value)) this.report("cubic-bezier needs four numbers");
        return v.value;
      case "list":
        return v.items.map((item) => this.value(item, where)).join(" ");
      case "expression":
        return `calc(${this.expr(v.expr, where)})`;
      case "unresolved": {
        const ref = v.text.match(/\{[^}]+\}/);
        this.report(ref ? `unresolved reference ${ref[0]}` : "unresolved value");
        return v.text;
      }
      case "raw":
        if (typeof v.value === "object" && v.value !== null) {
          this.report("an object where CSS needs a value");
          return JSON.stringify(v.value);
        }
        return `${v.value}`;
      case "typography": {
        const types = PROPERTY_TYPES.typography;
        const p = (name: keyof typeof types & keyof typeof v) =>
          this.prop(v[name] as TokenValue | undefined, [...position, name], sub(name, types[name]));
        const weight = p("fontWeight");
        const size = p("fontSize") ?? `${this.f.basePxFontSize}px`;
        const lineHeight = p("lineHeight");
        const family = p("fontFamily") ?? "sans-serif";
        return `${weight ? `${weight} ` : ""}${size}${lineHeight ? `/${lineHeight}` : ""} ${family}`;
      }
      case "shadow":
        return v.layers
          .map((layer, i) => {
            const part = (name: "offsetX" | "offsetY" | "blur" | "spread" | "color") =>
              this.prop(layer[name], [...position, i, name], where)!;
            return `${layer.inset ? "inset " : ""}${part("offsetX")} ${part("offsetY")} ${part("blur")} ${part("spread")} ${part("color")}`;
          })
          .join(", ");
      case "border": {
        const types = PROPERTY_TYPES.border;
        const width = this.prop(v.width, [...position, "width"], sub("width", types.width));
        let style = this.prop(v.style, [...position, "style"], sub("style", types.style));
        if (v.style?.kind === "raw") style = "dashed";
        const color = this.prop(v.color, [...position, "color"], sub("color", types.color));
        return `${width ? `${width} ` : ""}${style ?? "none"}${color ? ` ${color}` : ""}`;
      }
      case "transition": {
        const types = PROPERTY_TYPES.transition;
        return (["duration", "timingFunction", "delay"] as const)
          .map((name) => this.prop(v[name], [...position, name], sub(name, types[name])))
          .filter((s) => s !== undefined)
          .join(" ");
      }
    }
  }
}

/**
 * A value as CSS. `report` hears why it is no valid CSS; `at` may put a
 * `var()` in place of a composite's property.
 */
export function formatValue(value: TokenValue, where: Where, f: Format, report: Report, at: AtPosition = () => undefined): string {
  return new Formatter(f, report, at).value(value, where);
}

/**
 * A resolved value as render writes it, for callers that show values (the
 * MCP server). Units and colours follow the options as in `renderVariables`;
 * `problems` says why the value would be no valid CSS.
 */
export function formatTokenValue(
  value: TokenValue,
  where: Where,
  options: { units?: UnitPolicy | UnitPreset; basePxFontSize?: number; color?: ColorForm } = {}
): { text: string; problems: string[] } {
  const problems: string[] = [];
  const text = formatValue(
    value,
    where,
    { units: unitPolicy(options.units), basePxFontSize: options.basePxFontSize ?? 16, color: options.color ?? "source" },
    (reason) => problems.push(reason)
  );
  return { text, problems };
}
