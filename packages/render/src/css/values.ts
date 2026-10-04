/**
 * The finished value of every token of one theme: references replaced by
 * their targets' finished values, then the chain (all steps for a literal,
 * transitive steps for a token that used references).
 */
import type { Dictionary, Entry } from "./dictionary.js";
import { resolveReferences, usesReferences } from "./references.js";
import { transform, type Presentation } from "./transforms.js";

export type Values = Map<string, unknown>;

export function finishValues(dict: Dictionary, presentation: Presentation): Values {
  const done: Values = new Map();
  const visiting = new Set<string>();

  const lookup = (key: string): unknown => {
    const entry = dict.byKey.get(key);
    return entry ? finish(entry) : undefined;
  };

  function finish(entry: Entry): unknown {
    if (done.has(entry.key)) return done.get(entry.key);
    // A cycle stays unresolved, as in Style Dictionary.
    if (visiting.has(entry.key)) return undefined;
    visiting.add(entry.key);

    const modify = entry.modify && usesReferences(entry.modify)
      ? (resolveReferences(entry.modify, lookup) as Record<string, unknown>)
      : entry.modify;
    const base = { type: entry.type, originalType: entry.originalType, modify };

    let value: unknown;
    if (usesReferences(entry.original)) {
      const resolved = resolveReferences(entry.original, lookup);
      value = usesReferences(resolved) ? resolved : transform({ ...base, value: resolved }, true, presentation);
    } else {
      value = transform({ ...base, value: entry.original }, false, presentation);
    }

    visiting.delete(entry.key);
    done.set(entry.key, value);
    return value;
  }

  for (const entry of dict.entries) finish(entry);
  return done;
}
