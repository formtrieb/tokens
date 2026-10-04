/**
 * The value chain behind today's CSS, step for step: Tokens Studio meaning
 * from core (`canonicalize`), CSS presentation here. The order and the
 * transitive flags are those of the resolver's Style-Dictionary platform
 * (sd-transforms' `tokens-studio` group, SD's `css` group, then the
 * resolver's own list), so the bytes come out the same.
 *
 * A token without references runs every step. A token with references runs
 * only the transitive steps, after its references were replaced by their
 * targets' finished values — which is why a line height pointing at a
 * dimension ships in rem while a literal one stays px.
 */
import {
  applyColorModifier,
  evaluateMathFor,
  fontWeightFor,
  letterSpacingFor,
  lineHeightFor,
  opacityFor,
  pxFor,
} from "@formtrieb/tokens-core";
import { tinycolor, toHexString, toRgb, toRgbString } from "./tinycolor.js";

export interface Working {
  value: unknown;
  type?: string;
  originalType?: string;
  modify?: Record<string, unknown>;
}

interface Step {
  transitive: boolean;
  filter: (t: Working) => boolean;
  apply: (t: Working) => unknown;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const typeIs = (...types: string[]) => (t: Working) => !!t.type && types.includes(t.type);

// ── CSS presentation ──────────────────────────────────────────────────────

/** SD's `getTokenDimensionValue` for string values. */
function dimension(val: unknown): { value: unknown; unit?: string } {
  if (isObj(val) && !Array.isArray(val)) return { value: val.value, unit: val.unit as string | undefined };
  const unitMatch = `${val}`.match(/[^0-9.-]+$/);
  const without = `${val}`.replace(unitMatch?.[0] ?? "", "");
  if (unitMatch && !Number.isNaN(parseFloat(without))) return { value: without, unit: unitMatch[0] };
  return { value: val };
}

/** SD `size/rem`: a unit is kept, a bare number becomes rem 1:1. Unparseable stays. */
function sizeRem(val: unknown): unknown {
  const d = dimension(val);
  const n = parseFloat(`${d.value}`);
  if (isNaN(n)) return val;
  if (d.unit !== undefined) return `${d.value}${d.unit}`;
  if (n === 0) return d.value;
  return `${n}rem`;
}

const PX_OR_UNITLESS = /^-?(\d+\.?\d*|\.\d+)(px)?$/;

/** The resolver's `pxToRem`: px or unitless only, divided by the base size. */
function pxToRem(base: number) {
  return (val: unknown): unknown => {
    const d = dimension(val);
    const n = parseFloat(`${d.value}`);
    if (isNaN(n)) return val;
    if (n === 0) return d.value;
    return `${n / base}rem`;
  };
}

function isColor(t: Working): boolean {
  if (t.type !== "color") return false;
  const v = t.value;
  return (
    tinycolor(v).ok &&
    ["linear", "radial", "conic"].every((p) => !`${v}`.startsWith(`${p}-gradient`) && !`${v}`.startsWith(`repeating-${p}-gradient`))
  );
}

function colorCss(val: unknown): string {
  const c = tinycolor(val);
  const { r, g, b, a } = toRgb(c);
  return a === 1 ? toHexString(c) : `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** sd-transforms `hexrgba`: `rgba(#hex, a)` → `rgba(r, g, b, a)`. */
function hexRgba(val: string): string {
  return val.replace(/rgba\(\s*(?<hex>#.+?)\s*,\s*(?<alpha>\d*(\.\d*|%)*)\s*\)/g, (match, hex: string, alpha: string) => {
    const c = tinycolor(hex);
    if (!c.ok) return match;
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
  });
}

function hexRgbaFor(t: Working): unknown {
  const v = t.value;
  if (t.type === "shadow" || t.type === "border") {
    const prop = (o: unknown) => {
      if (isObj(o) && typeof o.color === "string") o.color = hexRgba(o.color);
      return o;
    };
    return Array.isArray(v) ? v.map(prop) : prop(v);
  }
  return typeof v === "string" ? hexRgba(v) : v;
}

function innerShadow(v: unknown): unknown {
  const align = (type: unknown) => (type === "innerShadow" || type === "inset" ? "inset" : undefined);
  if (Array.isArray(v)) return v.map((s) => ({ ...s, type: align(s?.type) }));
  if (isObj(v)) v.type = align(v.type);
  return v;
}

function quoteFont(input: string): string {
  let name = input.trim();
  const quoted = (name.startsWith("'") && name.endsWith("'")) || (name.startsWith('"') && name.endsWith('"'));
  if (!quoted) name = name.replace(/'/g, "\\'");
  return /\s+/.test(name) && !quoted ? `'${name}'` : name;
}

function fontFamily(family: unknown): unknown {
  let f = family;
  if (typeof f === "string" && f.includes(",")) f = f.split(",").map((p) => p.trim());
  if (Array.isArray(f)) return f.map((p) => quoteFont(p)).join(", ");
  return quoteFont(f as string);
}

function fontFamilyFor(t: Working): unknown {
  const v = t.value;
  if (t.type === "typography") return isObj(v) && v.fontFamily ? { ...v, fontFamily: fontFamily(v.fontFamily) } : v;
  return fontFamily(v);
}

function cubicBezier(t: Working): unknown {
  const easing = (e: unknown) => (Array.isArray(e) ? `cubic-bezier(${e.join(", ")})` : e);
  const v = t.value;
  if (t.type === "transition") return isObj(v) && v.timingFunction ? { ...v, timingFunction: easing(v.timingFunction) } : v;
  return easing(v);
}

const normalizeDim = (p: unknown) => {
  if (p === undefined) return p;
  const d = dimension(p);
  return `${d.value}${d.unit ?? ""}`;
};

const colorOf = (v: Obj) => (typeof v.color === "string" ? v.color : undefined);

function borderShorthand(v: unknown): unknown {
  if (!isObj(v)) return v;
  const color = colorOf(v);
  const width = normalizeDim(v.width);
  let style = v.style;
  if (typeof style === "object") style = "dashed";
  return `${width ? `${width} ` : ""}${style ? `${style}` : "none"}${color ? ` ${color}` : ""}`;
}

function typographyShorthand(base: number) {
  return (v: unknown): unknown => {
    if (!isObj(v)) return v;
    const fontSize = normalizeDim(v.fontSize);
    const lineHeight = normalizeDim(v.lineHeight);
    const { fontWeight, fontVariant, fontWidth, fontStyle } = v;
    const family = v.fontFamily ?? "sans-serif";
    return `${fontStyle ? `${fontStyle} ` : ""}${fontVariant ? `${fontVariant} ` : ""}${fontWeight ? `${fontWeight} ` : ""}${
      fontWidth ? `${fontWidth} ` : ""
    }${fontSize ? `${fontSize}` : `${base}px`}${lineHeight ? `/${lineHeight} ` : " "}${family}`;
  };
}

function shadowShorthand(v: unknown): unknown {
  if (!isObj(v)) return v;
  const one = (s: unknown) => {
    if (!isObj(s)) return s;
    const offsetX = normalizeDim(s.offsetX);
    const offsetY = normalizeDim(s.offsetY);
    const blur = normalizeDim(s.blur);
    const spread = normalizeDim(s.spread);
    const color = colorOf(s);
    return `${s.inset || s.type === "inset" ? "inset " : ""}${offsetX ?? 0} ${offsetY ?? 0} ${blur ?? 0} ${
      spread ? `${spread} ` : ""
    }${color ?? "#000000"}`;
  };
  return Array.isArray(v) ? v.map(one).join(", ") : one(v);
}

function transitionShorthand(v: unknown): unknown {
  if (!isObj(v)) return v;
  return `${v.duration} ${v.timingFunction} ${v.delay}`;
}

// ── the chain ─────────────────────────────────────────────────────────────

function modifier(t: Working): unknown {
  const m = t.modify as { type: string; value: string; space: string; color?: string } | undefined;
  if (!m) return t.value;
  return applyColorModifier(t.value as string, m, "srgb") ?? t.value;
}

function steps(basePxFontSize: number): Step[] {
  const T = true;
  const F = false;
  const resolveMath: Step = { transitive: T, filter: (t) => typeof t.value === "string" || isObj(t.value), apply: (t) => evaluateMathFor(t.value, t.type) };
  const opacity: Step = { transitive: T, filter: typeIs("opacity"), apply: (t) => opacityFor(t.value, t.type) };
  const lineHeight: Step = { transitive: T, filter: typeIs("lineHeight", "typography"), apply: (t) => lineHeightFor(t.value, t.type) };
  const fontWeight: Step = { transitive: T, filter: typeIs("fontWeight", "typography"), apply: (t) => fontWeightFor(t.value, t.type) };
  const letterSpacing: Step = {
    transitive: T,
    filter: (t) => typeIs("letterSpacing", "typography")(t) || t.originalType === "letterSpacing",
    apply: (t) => letterSpacingFor(t.value, t.type, t.originalType),
  };
  const hexrgba: Step = { transitive: T, filter: typeIs("color", "shadow", "border"), apply: hexRgbaFor };
  const color: Step = { transitive: F, filter: isColor, apply: (t) => colorCss(t.value) };
  const font: Step = { transitive: T, filter: typeIs("fontFamily", "typography"), apply: fontFamilyFor };

  return [
    resolveMath,
    { transitive: T, filter: typeIs("fontSize", "dimension", "typography", "border", "shadow"), apply: (t) => pxFor(t.value, t.type) },
    opacity,
    lineHeight,
    fontWeight,
    {
      transitive: T,
      filter: (t) => typeof t.value === "string" && t.type === "color" && !!t.modify,
      apply: modifier,
    },
    hexrgba,
    letterSpacing,
    { transitive: T, filter: typeIs("shadow"), apply: (t) => innerShadow(t.value) },
    { transitive: F, filter: typeIs("dimension", "fontSize"), apply: (t) => sizeRem(t.value) },
    color,
    font,
    { transitive: T, filter: typeIs("cubicBezier", "transition"), apply: cubicBezier },
    { transitive: T, filter: typeIs("strokeStyle"), apply: (t) => (isObj(t.value) ? "dashed" : t.value) },
    { transitive: T, filter: typeIs("border"), apply: (t) => borderShorthand(t.value) },
    { transitive: T, filter: typeIs("typography"), apply: (t) => typographyShorthand(basePxFontSize)(t.value) },
    { transitive: T, filter: typeIs("transition"), apply: (t) => transitionShorthand(t.value) },
    { transitive: T, filter: typeIs("shadow"), apply: (t) => shadowShorthand(t.value) },
    resolveMath,
    opacity,
    lineHeight,
    fontWeight,
    letterSpacing,
    hexrgba,
    color,
    { transitive: F, filter: isColor, apply: (t) => toRgbString(tinycolor(t.value)) },
    {
      transitive: F,
      filter: (t) => typeIs("dimension", "fontSize")(t) && (typeof t.value === "number" || PX_OR_UNITLESS.test(String(t.value).trim())),
      apply: (t) => pxToRem(basePxFontSize)(t.value),
    },
    font,
  ];
}

const cache = new Map<number, Step[]>();

/** Run the chain on a resolved value; `transitiveOnly` for tokens that used references. */
export function transform(token: Working, transitiveOnly: boolean, basePxFontSize: number): unknown {
  let chain = cache.get(basePxFontSize);
  if (!chain) cache.set(basePxFontSize, (chain = steps(basePxFontSize)));
  const t: Working = { ...token, value: structuredClone(token.value) };
  for (const step of chain) {
    if (transitiveOnly && !step.transitive) continue;
    if (!step.filter(t)) continue;
    try {
      t.value = step.apply(t);
    } catch {
      // Style Dictionary keeps the value when a transform throws.
    }
  }
  return t.value;
}
