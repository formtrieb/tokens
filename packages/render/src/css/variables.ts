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
import type { RenderOptions, RenderRule } from "../types.js";
import type { Dictionary, Entry } from "./dictionary.js";
import { referencesIn, resolveReferences, usesReferences } from "./references.js";
import type { Values } from "./values.js";

export const FILE_HEADER = "/**\n * Do not edit directly, this file was auto-generated.\n */\n\n";

export interface Block {
  text: string;
  /** typography companions were appended; the resolver wrote such a file without final newline */
  expanded: boolean;
}

function isPrivate(path: string[], prefixes: string[]): boolean {
  return path.some((segment) => prefixes.some((p) => segment.startsWith(p)));
}

const nameOf = (path: string[], prefix: string) => kebab(`${prefix} ${path.join(" ")}`);

// ── FOR-496: arithmetic is written as calc() ──────────────────────────────

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

function declaration(entry: Entry, dict: Dictionary, values: Values, rule: RenderRule, prefix: string): string {
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
function companions(entries: Entry[], options: RenderOptions): string[] {
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

export function renderBlock(dict: Dictionary, values: Values, rule: RenderRule, options: RenderOptions): Block {
  const emitted = dict.entries.filter((e) => e.isSource && !isPrivate(e.path, options.privateTokenPrefixes));
  const ordered = rule.references ? [...emitted].sort(referenceOrder(dict, options.prefix)) : emitted;
  const lines = ordered.map((e) => declaration(e, dict, values, rule, options.prefix));
  const extra = companions(emitted, options);

  const body = extra.length > 0 ? `${lines.join("\n")}\n${extra.join("\n")}\n` : lines.join("\n");
  let text = `${rule.selector} {\n${body}\n}`;
  if (rule.media) text = `@media ${rule.media} {\n${text}\n}`;
  return { text, expanded: extra.length > 0 };
}
