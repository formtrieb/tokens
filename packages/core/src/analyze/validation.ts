import type { PlaceholderToken, StructuralDiff } from "../types.js";
import { referencesIn } from "../system/resolve.js";
import type { DictionaryEntry } from "../system/types.js";

const PLACEHOLDER_COLOR = "#f305b7";

export function findPlaceholders(
  tokens: DictionaryEntry[],
  setFilter?: string
): PlaceholderToken[] {
  const filtered = setFilter
    ? tokens.filter((t) => t.set === setFilter)
    : tokens;

  return filtered
    .filter(
      (t) =>
        typeof t.value === "string" &&
        t.value.toLowerCase() === PLACEHOLDER_COLOR
    )
    .map((t) => ({
      path: t.key,
      sourceSet: t.set,
      context: getContext(t.path),
    }));
}

export function findBrokenReferences(
  tokens: DictionaryEntry[],
  allPaths: Set<string>
): Array<{ path: string; rawValue: string; missingRef: string; sourceSet: string }> {
  const broken: Array<{
    path: string;
    rawValue: string;
    missingRef: string;
    sourceSet: string;
  }> = [];

  for (const token of tokens) {
    if (typeof token.value !== "string") continue;

    const refs = referencesIn(token.value);
    for (const ref of refs) {
      if (!allPaths.has(ref)) {
        broken.push({
          path: token.key,
          rawValue: token.value,
          missingRef: ref,
          sourceSet: token.set,
        });
      }
    }
  }

  return broken;
}

export function compareStructure(
  tokensA: DictionaryEntry[],
  tokensB: DictionaryEntry[],
  labelA: string,
  labelB: string
): StructuralDiff {
  const pathsA = new Map(tokensA.map((t) => [t.key, t.type ?? ""]));
  const pathsB = new Map(tokensB.map((t) => [t.key, t.type ?? ""]));

  const missingInA: string[] = [];
  const missingInB: string[] = [];
  const typeMismatches: Array<{ path: string; typeA: string; typeB: string }> =
    [];

  for (const [path, type] of pathsA) {
    if (!pathsB.has(path)) {
      missingInB.push(path);
    } else if (pathsB.get(path) !== type) {
      typeMismatches.push({ path, typeA: type, typeB: pathsB.get(path)! });
    }
  }

  for (const path of pathsB.keys()) {
    if (!pathsA.has(path)) {
      missingInA.push(path);
    }
  }

  return {
    identical:
      missingInA.length === 0 &&
      missingInB.length === 0 &&
      typeMismatches.length === 0,
    missingInA,
    missingInB,
    typeMismatches,
  };
}

function getContext(path: string[]): string {
  if (path.length >= 3) {
    return path.slice(0, -1).join(".");
  }
  return path.join(".");
}
