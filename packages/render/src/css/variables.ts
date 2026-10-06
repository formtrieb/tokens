/**
 * One render rule → one block of custom properties, in the shape the
 * resolver has always written (Style Dictionary's `css/variables`):
 *
 *   - only tokens of the theme's enabled sets, private paths left out
 *   - with references: a token that points elsewhere is written as
 *     `var(--…)`; tokens are ordered so a variable is defined before use
 *   - typography composites get their companion properties appended
 */
import { kebab } from "../kebab.js";
import { writesCompanions, type ResolvedRenderOptions, type RenderRule } from "../types.js";
import type { Dictionary, Entry } from "./dictionary.js";
import { referencesIn, resolveReferences, usesReferences } from "./references.js";
import type { Values } from "./values.js";

export const FILE_HEADER = "/**\n * Do not edit directly, this file was auto-generated.\n */\n\n";

export interface Block {
  text: string;
  /** typography companions were appended; the resolver wrote such a file without final newline */
  expanded: boolean;
  /** values that are no valid CSS, by token path */
  invalid: { path: string; value: string; reason: string }[];
}

// ── a value that is no CSS is not written ─────────────────────────────────

const EASING_KEYWORDS = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\([^)]*\))$/;
const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)`;
const BEZIER = new RegExp(String.raw`^cubic-bezier\(${NUMBER}, ${NUMBER}, ${NUMBER}, ${NUMBER}\)$`);
/** Types whose value is a single quantity; there, leftover arithmetic is an error. */
const QUANTITIES = new Set(["dimension", "fontSize", "lineHeight", "number", "opacity", "fontWeight", "duration"]);
/** CSS math functions. Whatever stands inside their parentheses is arithmetic by design. */
const MATH_FUNCTION = /\b(calc|clamp|min|max|round|mod|rem|abs|sign|pow|sqrt|hypot|log|exp)\(/;

/**
 * The value with every math function blanked to `name()`, however deep its
 * parentheses nest — `calc((var(--a) - var(--b)) / 2)` becomes `calc()`.
 * A regex cannot do this (it knows one level); a counter can.
 */
function withoutMathFunctions(value: string): string {
  let out = "";
  let rest = value;
  for (;;) {
    const m = MATH_FUNCTION.exec(rest);
    if (!m) return out + rest;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < rest.length; close++) {
      if (rest[close] === "(") depth++;
      else if (rest[close] === ")" && --depth === 0) break;
    }
    out += rest.slice(0, m.index) + m[1] + "()";
    rest = rest.slice(close + 1);
  }
}

const LEFTOVER_MATH = /(?:\d[a-zA-Z%]*|\))(?:\s*[*/+]\s*|-|\s-\s)(?:\d|\.\d|var\()/;

/**
 * Why a written value is no valid CSS, or undefined. Checks what the source
 * can get wrong: an object where text belongs, a reference that never
 * resolved, a bezier without four numbers, arithmetic not in calc().
 */
export function invalidCss(value: string, type: string | undefined): string | undefined {
  if (value.includes("[object Object]")) return "an object where CSS needs a value";
  const ref = value.match(/\{[^}]+\}/);
  if (ref) return `unresolved reference ${ref[0]}`;
  if (type === "cubicBezier" && !value.startsWith("var(") && !BEZIER.test(value) && !EASING_KEYWORDS.test(value)) {
    return "cubic-bezier needs four numbers";
  }
  if (type && QUANTITIES.has(type)) {
    // Variable names may hold digits and dashes (`--x-0-5x`); only their position counts.
    const outside = withoutMathFunctions(value).replace(/var\(--[\w-]+\)/g, "(v)");
    if (LEFTOVER_MATH.test(outside)) return "arithmetic that is neither reduced nor in calc()";
  }
  return undefined;
}

function isPrivate(path: string[], prefixes: string[]): boolean {
  return path.some((segment) => prefixes.some((p) => segment.startsWith(p)));
}

const nameOf = (path: string[], prefix: string) => kebab(`${prefix} ${path.join(" ")}`);

// ── arithmetic is written as calc() ───────────────────────────────────────

const OPERAND = /(?:var\(--[\w-]+\)|-?(?:\d+\.?\d*|\.\d+)[a-zA-Z%]*)/y;
const OPERATOR = /\s*([-+*/])\s*/y;

/**
 * `var(--x)-1px` is no CSS; `calc(var(--x) - 1px)` is. Only a value made of
 * operands and operators is rewritten — a single negative number, a list of
 * lengths or a function call stay as they are.
 */
export function asCalc(value: string): string {
  const parts: string[] = [];
  let pos = 0;
  for (;;) {
    OPERAND.lastIndex = pos;
    const operand = OPERAND.exec(value);
    if (!operand) return value;
    parts.push(operand[0]);
    pos = OPERAND.lastIndex;
    if (pos === value.length) break;
    OPERATOR.lastIndex = pos;
    const operator = OPERATOR.exec(value);
    if (!operator) return value;
    parts.push(operator[1]);
    pos = OPERATOR.lastIndex;
  }
  return parts.length > 1 ? `calc(${parts.join(" ")})` : value;
}

// ── reference-safe order, as Style Dictionary's sortByReference ───────────

interface Sortable {
  name?: string;
  original?: unknown;
}

function referenceOrder(dict: Dictionary, prefix: string) {
  const asSortable = (r: { entry?: Entry }): Sortable =>
    r.entry ? { name: nameOf(r.entry.path, prefix), original: r.entry.original } : {};

  const sorter = (a: Sortable | undefined, b: Sortable | undefined, depth = 0): number => {
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (depth > 64) return 0;
    const aUses = a.original !== undefined && usesReferences(a.original);
    const bUses = b.original !== undefined && usesReferences(b.original);
    if (aUses && bUses) {
      const aRefs = referencesIn(a.original, dict).map(asSortable);
      const bRefs = referencesIn(b.original, dict).map(asSortable);
      if (aRefs.some((r) => r.name !== undefined && r.name === b.name)) return 1;
      if (bRefs.some((r) => r.name !== undefined && r.name === a.name)) return -1;
      return sorter(aRefs[0], bRefs[0], depth + 1);
    }
    if (aUses) return 1;
    if (bUses) return -1;
    return 0;
  };
  return (a: Entry, b: Entry) =>
    sorter({ name: nameOf(a.path, prefix), original: a.original }, { name: nameOf(b.path, prefix), original: b.original });
}

// ── one declaration ───────────────────────────────────────────────────────

function withComment(line: string, description: string | undefined): string {
  if (!description) return line;
  const lines = description.split("\n");
  if (lines.length === 1) return `${line} /** ${description} */`;
  const comment = `  /**\n${lines.map((l) => `   * ${l}\n`).join("")}   */`;
  return `${comment}\n${line}`;
}

function declaration(
  entry: Entry,
  dict: Dictionary,
  values: Values,
  rule: RenderRule,
  prefix: string,
  invalid: Block["invalid"]
): string {
  const value = values.get(entry.key);
  const original = entry.original;
  const finished = (key: string) => values.get(key);

  let outputRef = rule.references && usesReferences(original);
  if (outputRef && entry.modify) {
    // A computed colour keeps its computed value, unless computing changed nothing.
    outputRef = typeof original === "string" && value === resolveReferences(original, finished);
  }

  let out: unknown = value;
  if (outputRef) {
    const refs = referencesIn(original, dict).filter((r) => r.entry && values.has(r.key));
    if (typeof original !== "object" || original === null) {
      let text = `${original}`;
      for (const r of refs) {
        const pattern = new RegExp(`{${r.entry!.path.join("\\.")}(\\.\\$?value)?}`, "g");
        text = text.replace(pattern, () => `var(--${nameOf(r.entry!.path, prefix)})`);
      }
      out = text;
    } else {
      let text = `${value}`;
      for (const r of refs) {
        text = text.replace(`${values.get(r.key)}`, () => `var(--${nameOf(r.entry!.path, prefix)})`);
      }
      out = entry.type === "typography" ? fontOrder(text, original as Record<string, unknown>, dict, prefix) : text;
    }
  }
  if (typeof out === "string") out = asCalc(out);
  const text = `${out}`;
  const reason = invalidCss(text, entry.type);
  if (reason) invalid.push({ path: entry.key, value: text, reason });
  return withComment(`  --${nameOf(entry.path, prefix)}: ${out};`, entry.description);
}

/**
 * Replacing references in a typography shorthand by value can land the line
 * height's variable before the font size's when both had the same value. The
 * resolver swapped them back afterwards; so does this.
 */
function fontOrder(text: string, original: Record<string, unknown>, dict: Dictionary, prefix: string): string {
  const varOf = (prop: string) => {
    const ref = referencesIn(original[prop], dict)[0];
    return ref?.entry ? `var(--${nameOf(ref.entry.path, prefix)})` : undefined;
  };
  const fs = varOf("fontSize");
  const lh = varOf("lineHeight");
  if (!fs || !lh) return text;
  return text.split(`${lh}/${fs}`).join(`${fs}/${lh}`);
}

// ── typography companions ─────────────────────────────────────────────────

const COMPANIONS: [string, string][] = [
  ["letterSpacing", "letter-spacing"],
  ["textCase", "text-transform"],
  ["textDecoration", "text-decoration"],
  ["paragraphIndent", "text-indent"],
  ["paragraphSpacing", "margin-block-end"],
];

/**
 * The `font` shorthand cannot carry letter-spacing, text-transform and the
 * rest; each typography token gets them as companion properties pointing at
 * the referenced tokens, plus `-fvn: tabular-nums` where configured.
 */
function companions(entries: Entry[], options: ResolvedRenderOptions): string[] {
  const prefix = options.prefix;
  const tabular = (options.typography.fontVariantNumeric?.tabular ?? []).map((p) => p.map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "typography" || typeof entry.original !== "object" || entry.original === null) continue;
    const value = entry.original as Record<string, unknown>;
    const full = `--${prefix}${kebab(entry.path)}`;
    for (const [prop, suffix] of COMPANIONS) {
      const ref = typeof value[prop] === "string" ? (value[prop] as string).match(/^\{(.+)\}$/) : null;
      if (ref) out.push(`  ${full}-${suffix}: var(--${prefix}${kebab(ref[1].replace(/\./g, "-"))});`);
    }
    const lower = entry.path.map((s) => s.toLowerCase());
    if (tabular.some((p) => p.length > 0 && p.every((seg, i) => lower[i] === seg))) out.push(`  ${full}-fvn: tabular-nums;`);
  }
  return out;
}

// ── block ─────────────────────────────────────────────────────────────────

export function renderBlock(dict: Dictionary, values: Values, rule: RenderRule, options: ResolvedRenderOptions): Block {
  const emitted = dict.entries.filter((e) => e.isSource && !isPrivate(e.path, options.privateTokenPrefixes));
  const ordered = rule.references ? [...emitted].sort(referenceOrder(dict, options.prefix)) : emitted;
  const invalid: Block["invalid"] = [];
  const lines = ordered.map((e) => declaration(e, dict, values, rule, options.prefix, invalid));
  const extra = writesCompanions(options) ? companions(emitted, options) : [];

  const body = extra.length > 0 ? `${lines.join("\n")}\n${extra.join("\n")}\n` : lines.join("\n");
  let text = `${rule.selector} {\n${body}\n}`;
  if (rule.media) text = `@media ${rule.media} {\n${text}\n}`;
  return { text, expanded: extra.length > 0, invalid };
}
