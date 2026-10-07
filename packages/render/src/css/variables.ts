/**
 * One render rule → one block of custom properties:
 *
 *   - the tokens of the theme's enabled sets, in source order, private paths
 *     left out (a custom property may use one declared after it: `var()`
 *     resolves at computed-value time)
 *   - each value as core resolved it, written by the formatters
 *   - with references: a token that points elsewhere is written as
 *     `var(--…)`, in a composite at the position of the property that points
 *   - optionally the typography companions
 */
import { referencesIn, type Dictionary, type DictionaryEntry, type Resolution, type TokenValue } from "@formtrieb/tokens-core";
import { kebab } from "../kebab.js";
import type { ResolvedRenderOptions, RenderRule } from "../types.js";
import { formatValue, type Format, type Position } from "./format.js";

export const FILE_HEADER = "/**\n * Do not edit directly, this file was auto-generated.\n */\n\n";

export interface Block {
  text: string;
  /** values that are no valid CSS, by token path */
  invalid: { path: string; value: string; reason: string }[];
}

const PURE_REFERENCE = /^\{([^{}]+)\}$/;
const REFERENCE = /\{([^{}]+)\}/g;
const ARITHMETIC_KINDS = new Set<TokenValue["kind"]>(["length", "number", "expression", "list"]);

function isPrivate(path: string[], prefixes: string[]): boolean {
  return path.some((segment) => prefixes.some((p) => segment.startsWith(p)));
}

const nameOf = (path: string[], prefix: string) => kebab(`${prefix} ${path.join(" ")}`);

const keyOf = (inner: string) => inner.trim().replace(/\.\$value$/, "");

// ── arithmetic over var() is written as calc() ────────────────────────────

const OPERAND = /(?:var\(--[\w-]+\)|-?(?:\d+\.?\d*|\.\d+)[a-zA-Z%]*)/y;
const OPERATOR = /\s*([-+*/])\s*/y;

/**
 * `var(--x)-1px` is no CSS; `calc(var(--x) - 1px)` is. Only for a value with
 * references, written as variables: a resolved value's arithmetic is an
 * `expression` and needs no scanning. Only a value made of operands and
 * operators is rewritten — a single number, a list or a function call stays.
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

// ── one declaration ───────────────────────────────────────────────────────

function withComment(line: string, description: string | undefined): string {
  if (!description) return line;
  const lines = description.split("\n");
  if (lines.length === 1) return `${line} /** ${description} */`;
  const comment = `  /**\n${lines.map((l) => `   * ${l}\n`).join("")}   */`;
  return `${comment}\n${line}`;
}

const SHADOW_ALIASES: Record<string, string> = { offsetX: "x", offsetY: "y" };

/** The written value at a composite position: `["fontSize"]`, `[0, "blur"]`. */
function rawAt(raw: unknown, position: Position, shadow: boolean): unknown {
  let node: unknown = raw;
  let rest = position;
  if (shadow) {
    const [i, ...tail] = position;
    node = Array.isArray(raw) ? raw[i as number] : i === 0 ? raw : undefined;
    rest = tail;
  }
  for (const step of rest) {
    if (typeof node !== "object" || node === null) return undefined;
    const o = node as Record<string, unknown>;
    node = o[step as string] ?? (shadow ? o[SHADOW_ALIASES[step as string]] : undefined);
  }
  return node;
}

interface Context {
  dict: Dictionary;
  values: ReadonlyMap<string, Resolution>;
  rule: RenderRule;
  options: ResolvedRenderOptions;
  format: Format;
}

function declaration(entry: DictionaryEntry, ctx: Context, invalid: Block["invalid"]): string {
  const { dict, values, rule, options, format } = ctx;
  const reasons: string[] = [];
  const report = (reason: string) => reasons.push(reason);
  const where = { path: entry.path, type: entry.type };
  const resolved = values.get(entry.key)!.value;
  const varOf = (inner: string) => {
    const target = dict.byKey.get(keyOf(inner));
    return target ? `var(--${nameOf(target.path, options.prefix)})` : undefined;
  };
  const formatted = () => formatValue(resolved, where, format, report);

  let out: string;
  const raw = entry.value;
  if (!rule.references || referencesIn(raw).length === 0 || resolved.kind === "unresolved") {
    out = formatted();
  } else if (typeof raw === "string") {
    const pure = raw.trim().match(PURE_REFERENCE);
    if (pure) {
      const variable = varOf(pure[1]);
      out = variable ?? formatted();
      if (variable && entry.extensions?.["studio.tokens"] && (entry.extensions["studio.tokens"] as Record<string, unknown>).modify) {
        // A computed colour is written as computed, unless computing changed nothing.
        const target = values.get(keyOf(pure[1]))!.value;
        const asHex = (v: TokenValue) => formatValue(v, where, { ...format, color: "hex" }, () => {});
        if (asHex(resolved) !== asHex(target)) out = formatted();
      }
    } else if (ARITHMETIC_KINDS.has(resolved.kind)) {
      out = asCalc(raw.replace(REFERENCE, (match, inner: string) => varOf(inner) ?? match));
    } else {
      out = formatted();
    }
  } else {
    const shadow = resolved.kind === "shadow";
    out = formatValue(resolved, where, format, report, (position) => {
      const at = rawAt(raw, position, shadow);
      const pure = typeof at === "string" ? at.trim().match(PURE_REFERENCE) : null;
      return pure ? varOf(pure[1]) : undefined;
    });
  }

  for (const reason of reasons) invalid.push({ path: entry.key, value: out, reason });
  return withComment(`  --${nameOf(entry.path, options.prefix)}: ${out};`, entry.description);
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
 * rest; with `typographyCompanions`, each typography token gets them as
 * companion properties pointing at the referenced tokens, plus
 * `-fvn: tabular-nums` where configured.
 */
function companions(entries: DictionaryEntry[], options: ResolvedRenderOptions): string[] {
  const prefix = options.prefix;
  const tabular = (options.typography.fontVariantNumeric?.tabular ?? []).map((p) => p.map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.alignedType !== "typography" || typeof entry.value !== "object" || entry.value === null) continue;
    const value = entry.value as Record<string, unknown>;
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

export function renderBlock(
  dict: Dictionary,
  values: ReadonlyMap<string, Resolution>,
  rule: RenderRule,
  options: ResolvedRenderOptions
): Block {
  const emitted = dict.entries.filter((e) => e.emitted && !isPrivate(e.path, options.privateTokenPrefixes));
  const format: Format = { units: options.units, basePxFontSize: options.basePxFontSize, color: options.color };
  const ctx: Context = { dict, values, rule, options, format };
  const invalid: Block["invalid"] = [];
  const lines = emitted.map((e) => declaration(e, ctx, invalid));
  if (options.typographyCompanions) lines.push(...companions(emitted, options));
  let text = `${rule.selector} {\n${lines.join("\n")}\n}`;
  if (rule.media) text = `@media ${rule.media} {\n${text}\n}`;
  return { text, invalid };
}
