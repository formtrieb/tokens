/**
 * Resolution of a composed theme: every reference replaced, every value read
 * under its token's type.
 *
 * - `{a.b}` and `{a.b.$value}` name the same token; whitespace inside the
 *   braces does not count.
 * - A value that is exactly one reference takes the target's value; when that
 *   is a bare number or text, it is read again under the referring token's
 *   type (a number referenced by a `fontSizes` token is px).
 * - A reference inside longer text is replaced by the target's value as text
 *   (`textOf`), then the text is read under the token's type.
 * - Composites are read property by property, each with its own type; arrays
 *   (shadow layers) and the `studio.tokens` modifier are resolved alike.
 * - A reference without target, to a group, or closing a cycle is reported;
 *   the value keeps its text.
 */
import { applyModifier } from "./modify.js";
import { COMPOSITE_PROPERTIES, SHADOW_ALIASES, readScalar, textOf } from "./values.js";
import type { ColorModifier } from "../types.js";
import type { ChainStep, Dictionary, DictionaryEntry, Resolution, ShadowLayer, TokenProblem, TokenValue } from "./types.js";
import { alignType } from "./tokens-studio.js";

const REFERENCE = /\{([^{}]+)\}/g;
const PURE_REFERENCE = /^\{([^{}]+)\}$/;
const HAS_REFERENCE = /\{[^{}]+\}/;

/** `{ a.b.$value }` → `a.b`. */
export function referenceKey(inner: string): string {
  return inner.trim().replace(/\.\$value$/, "");
}

/** Every reference in a value, as token keys, in order of appearance; arrays and objects are walked. */
export function referencesIn(value: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(REFERENCE)) out.push(referenceKey(m[1]));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === "object" && v !== null) Object.values(v).forEach(visit);
  };
  visit(value);
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const unique = <T>(items: T[], id: (t: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = id(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

interface Memo {
  resolution: Resolution;
  /** Problems found while resolving this token itself, not its targets. */
  own: TokenProblem[];
}

class Resolver {
  private memo = new Map<string, Memo>();
  private visiting: string[] = [];
  private entryProblems = new Map<string, TokenProblem[]>();

  constructor(private dict: Dictionary) {
    for (const p of dict.problems) {
      if (!("path" in p)) continue;
      const list = this.entryProblems.get(p.path) ?? [];
      list.push(p);
      this.entryProblems.set(p.path, list);
    }
  }

  get(key: string): Memo {
    const done = this.memo.get(key);
    if (done) return done;
    const entry = this.dict.byKey.get(key)!;
    this.visiting.push(key);
    const walk = new Walk(this, entry);
    let value = walk.resolve(entry.value, entry.type);
    const modify = isObject(entry.extensions?.["studio.tokens"]) ? (entry.extensions["studio.tokens"] as Record<string, unknown>).modify : undefined;
    if (isObject(modify)) value = applyModifier(value, walk.resolveModifier(modify));
    this.visiting.pop();

    const step: ChainStep = {
      key,
      set: entry.set,
      value: entry.value,
      ...(isObject(modify) && { modify: modify as unknown as ColorModifier }),
    };
    const own = unique(walk.problems, (p) => JSON.stringify(p));
    const memo: Memo = {
      own,
      resolution: {
        key,
        value,
        chain: unique([step, ...walk.chain], (s) => s.key),
        problems: unique([...(this.entryProblems.get(key) ?? []), ...own, ...walk.inherited], (p) => JSON.stringify(p)),
      },
    };
    this.memo.set(key, memo);
    return memo;
  }

  /** The target of a reference, or the problem why there is none. */
  target(from: string, key: string): Memo | TokenProblem {
    if (!this.dict.byKey.has(key)) {
      return this.dict.groups.has(key)
        ? { kind: "group-reference", path: from, reference: key }
        : { kind: "unknown-reference", path: from, reference: key };
    }
    const at = this.visiting.indexOf(key);
    if (at >= 0) return { kind: "cycle", path: from, cycle: [...this.visiting.slice(at), key] };
    return this.get(key);
  }

  all(): { values: Map<string, Resolution>; problems: TokenProblem[] } {
    const values = new Map<string, Resolution>();
    for (const entry of this.dict.entries) values.set(entry.key, this.get(entry.key).resolution);
    const problems = [...this.dict.problems];
    for (const entry of this.dict.entries) problems.push(...this.memo.get(entry.key)!.own);
    return { values, problems };
  }
}

/** Resolving the value of one token: collects the chain and the problems on the way. */
class Walk {
  chain: ChainStep[] = [];
  problems: TokenProblem[] = [];
  inherited: TokenProblem[] = [];

  constructor(private resolver: Resolver, private entry: DictionaryEntry) {}

  private report = (p: TokenProblem) => this.problems.push(p);

  private follow(inner: string): TokenValue | undefined {
    const found = this.resolver.target(this.entry.key, referenceKey(inner));
    if ("kind" in found) {
      this.report(found);
      return undefined;
    }
    this.chain.push(...found.resolution.chain);
    this.inherited.push(...found.resolution.problems);
    return found.resolution.value;
  }

  resolve(raw: unknown, type: string | undefined): TokenValue {
    const aligned = alignType(type);
    if (aligned && aligned in COMPOSITE_PROPERTIES && (isObject(raw) || Array.isArray(raw))) return this.composite(raw, aligned);

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      const pure = trimmed.match(PURE_REFERENCE);
      if (pure) {
        const target = this.follow(pure[1]);
        if (target === undefined || target.kind === "unresolved") return { kind: "unresolved", text: raw };
        return this.coerce(target, type);
      }
      if (HAS_REFERENCE.test(raw)) {
        const { text, resolved } = this.substitute(raw);
        if (!resolved) return { kind: "unresolved", text };
        return readScalar(text, type, this.entry.key, this.report);
      }
    }
    if (Array.isArray(raw) && raw.some((v) => typeof v === "string" && HAS_REFERENCE.test(v))) {
      // `["{font.primary}", "sans-serif"]`, a bezier with a referenced point: each item as text.
      const items = raw.map((v) => (typeof v === "string" ? this.substitute(v) : { text: v, resolved: true }));
      if (items.some((i) => !i.resolved)) return { kind: "unresolved", text: items.map((i) => `${i.text}`).join(", ") };
      return readScalar(items.map((i) => i.text), type, this.entry.key, this.report);
    }
    return readScalar(raw, type, this.entry.key, this.report);
  }

  /** Every reference in a text replaced by its target as text (`textOf`); `resolved` false when one has no value. */
  private substitute(raw: string): { text: string; resolved: boolean } {
    let resolved = true;
    const text = raw.replace(REFERENCE, (match, inner: string) => {
      const target = this.follow(inner);
      if (target === undefined || target.kind === "unresolved") {
        resolved = false;
        return match;
      }
      return textOf(target);
    });
    return { text, resolved };
  }

  /** A referenced value read again under this token's type, where the target's kind carries no meaning of its own. */
  private coerce(target: TokenValue, type: string | undefined): TokenValue {
    if (type === undefined || (target.kind !== "number" && target.kind !== "string")) return target;
    return readScalar(textOf(target), type, this.entry.key, this.report);
  }

  private composite(raw: Record<string, unknown> | unknown[], type: string): TokenValue {
    const props = COMPOSITE_PROPERTIES[type];
    const read = (o: Record<string, unknown>) => {
      const out: Record<string, TokenValue> = {};
      for (const [k, v] of Object.entries(o)) {
        const name = type === "shadow" ? (SHADOW_ALIASES[k] ?? k) : k;
        if (name in props) out[name] = this.resolve(v, props[name]);
      }
      return out;
    };
    if (type === "shadow") {
      const layers = (Array.isArray(raw) ? raw : [raw]).map((layer): ShadowLayer => {
        const o = isObject(layer) ? layer : {};
        const p = read(o);
        const zero: TokenValue = { kind: "length", value: 0, unit: "px" };
        return {
          inset: o.type === "innerShadow" || o.type === "inset" || o.inset === true,
          offsetX: p.offsetX ?? zero,
          offsetY: p.offsetY ?? zero,
          blur: p.blur ?? zero,
          spread: p.spread ?? zero,
          color: p.color ?? { kind: "color", literal: "#000000", color: { mode: "rgb", r: 0, g: 0, b: 0 }, outOfGamut: false },
        };
      });
      return { kind: "shadow", layers };
    }
    if (!isObject(raw)) return { kind: "raw", value: raw };
    return { kind: type, ...read(raw) } as TokenValue;
  }

  /** The modifier with every reference resolved: amount as number, mix colour as colour. */
  resolveModifier(modify: Record<string, unknown>): { type: string; space: string; value: TokenValue; color?: TokenValue } {
    const str = (v: unknown) => {
      const r = this.resolve(v, "other");
      return r.kind === "string" ? r.value : textOf(r);
    };
    return {
      type: str(modify.type),
      space: str(modify.space),
      value: this.resolve(modify.value, "number"),
      ...(modify.color !== undefined && { color: this.resolve(modify.color, "color") }),
    };
  }
}

/** One token of a dictionary, resolved. A key the dictionary lacks resolves to its own text, with a problem. */
export function resolveToken(dict: Dictionary, key: string): Resolution {
  if (!dict.byKey.has(key)) {
    return { key, value: { kind: "unresolved", text: `{${key}}` }, chain: [], problems: [{ kind: "unknown-reference", path: key, reference: key }] };
  }
  return new Resolver(dict).get(key).resolution;
}

/** Every token of a dictionary, resolved; `problems` holds each problem once (the dictionary's and the resolution's). */
export function resolveDictionary(dict: Dictionary): { values: ReadonlyMap<string, Resolution>; problems: TokenProblem[] } {
  return new Resolver(dict).all();
}
