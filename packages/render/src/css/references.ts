/**
 * `{a.b.c}` references, read and resolved with Style Dictionary's rules:
 * a value that is exactly one reference takes the target's value as it is
 * (number, object, string); a reference inside a longer string is replaced
 * by the target's value as text, first occurrence first.
 */
import type { Dictionary, Entry } from "./dictionary.js";

const REFERENCE = /\{([^}]+)\}/g;

export function usesReferences(value: unknown): boolean {
  if (typeof value === "string") return /\{[^}]+\}/.test(value);
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) if (usesReferences(v)) return true;
  }
  return false;
}

function keyOf(inner: string): string {
  return inner.trim().replace(/\.\$value$/, "");
}

/**
 * Every reference in a value, in order of appearance, duplicates kept —
 * strings first-to-last, objects in key order. References to nothing are
 * dropped, references to a group come back without an entry.
 */
export function referencesIn(value: unknown, dict: Dictionary): { key: string; entry?: Entry }[] {
  const out: { key: string; entry?: Entry }[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(REFERENCE)) {
        const key = keyOf(m[1]);
        const entry = dict.byKey.get(key);
        if (entry) out.push({ key, entry });
        else if (pathExists(dict, key)) out.push({ key });
      }
    } else if (typeof v === "object" && v !== null) {
      for (const k of Object.keys(v)) {
        const p = (v as Record<string, unknown>)[k];
        if (typeof p === "string" || (typeof p === "object" && p !== null)) visit(p);
      }
    }
  };
  visit(value);
  return out;
}

function pathExists(dict: Dictionary, key: string): boolean {
  let node: unknown = dict.tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !Object.hasOwn(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

/**
 * Resolve every reference in `value` with `lookup` (the target's final
 * value). A reference whose target is unknown stays as written.
 */
export function resolveReferences(value: unknown, lookup: (key: string) => unknown | undefined): unknown {
  if (typeof value === "string") {
    if (!usesReferences(value)) return value;
    let out: unknown = value;
    for (const m of value.matchAll(REFERENCE)) {
      const target = lookup(keyOf(m[1]));
      if (target === undefined) continue;
      if (m[0] === out) out = target;
      else out = `${out}`.replace(m[0], `${target}`);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => resolveReferences(v, lookup));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveReferences(v, lookup);
    return out;
  }
  return value;
}
