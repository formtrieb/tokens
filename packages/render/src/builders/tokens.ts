import type { BuilderToken } from "../types.js";

/**
 * Every token of a set as builders see it: a node with a string `$type` and
 * a `$value`; `$`-keys are metadata and skipped.
 */
export function walkTokens(node: Record<string, unknown>, path: string[] = []): BuilderToken[] {
  const tokens: BuilderToken[] = [];
  for (const [key, raw] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (typeof raw !== "object" || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.$type === "string" && "$value" in obj) {
      tokens.push({ path: [...path, key], value: obj.$value, $type: obj.$type, raw: obj });
    } else {
      tokens.push(...walkTokens(obj, [...path, key]));
    }
  }
  return tokens;
}

/** `a.b.*` → every token below `a.b`; without `*`, the one token at that path. */
export function matchGlob(tokens: BuilderToken[], glob: string): BuilderToken[] {
  const segments = glob.split(".");
  const wildcard = segments.indexOf("*");
  if (wildcard === -1) return tokens.filter((t) => t.path.join(".") === glob);
  const prefix = segments.slice(0, wildcard);
  return tokens.filter((t) => t.path.length > prefix.length && prefix.every((seg, i) => t.path[i] === seg));
}

export function findByType(tokens: BuilderToken[], type: string): BuilderToken[] {
  return tokens.filter((t) => t.$type === type);
}

/** Class-name leaf for a glob: the path after the wildcard's position. */
export function globPrefixLength(source: string): number {
  const segments = source.split(".");
  const wildcard = segments.indexOf("*");
  return wildcard === -1 ? segments.length - 1 : wildcard;
}

/**
 * The tokens builders see: every set of the system in `$metadata.json`
 * order, first appearance of a path wins. Only names matter to builders,
 * and a path names the same variable in every set that defines it.
 */
export function builderTokens(sets: ReadonlyMap<string, Record<string, unknown>>, order: readonly string[]): BuilderToken[] {
  const byPath = new Map<string, BuilderToken>();
  const names = [...order, ...[...sets.keys()].filter((s) => !order.includes(s))];
  for (const name of names) {
    const set = sets.get(name);
    if (!set) continue;
    for (const token of walkTokens(set)) {
      const key = token.path.join(".");
      if (!byPath.has(key)) byPath.set(key, token);
    }
  }
  return [...byPath.values()];
}
