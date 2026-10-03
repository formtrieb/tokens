import type { RawToken, PlaceholderToken, StructuralDiff } from "../types.js";

const PLACEHOLDER_COLOR = "#f305b7";

export function findPlaceholders(
  tokens: RawToken[],
  setFilter?: string
): PlaceholderToken[] {
  const filtered = setFilter
    ? tokens.filter((t) => t.sourceSet === setFilter)
    : tokens;

  return filtered
    .filter(
      (t) =>
        typeof t.$value === "string" &&
        t.$value.toLowerCase() === PLACEHOLDER_COLOR
    )
    .map((t) => ({
      path: t.dotPath,
      sourceSet: t.sourceSet,
      context: getContext(t.path),
    }));
}

export function findBrokenReferences(
  tokens: RawToken[],
  allPaths: Set<string>
): Array<{ path: string; rawValue: string; missingRef: string; sourceSet: string }> {
  const broken: Array<{
    path: string;
    rawValue: string;
    missingRef: string;
    sourceSet: string;
  }> = [];

  for (const token of tokens) {
    if (typeof token.$value !== "string") continue;

    const refs = extractReferences(token.$value);
    for (const ref of refs) {
      if (!allPaths.has(ref)) {
        broken.push({
          path: token.dotPath,
          rawValue: token.$value,
          missingRef: ref,
          sourceSet: token.sourceSet,
        });
      }
    }
  }

  return broken;
}

export function compareStructure(
  tokensA: RawToken[],
  tokensB: RawToken[],
  labelA: string,
  labelB: string
): StructuralDiff {
  const pathsA = new Map(tokensA.map((t) => [t.dotPath, t.$type]));
  const pathsB = new Map(tokensB.map((t) => [t.dotPath, t.$type]));

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

function extractReferences(value: string): string[] {
  const refs: string[] = [];
  const pattern = /\{([^}]+)\}/g;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function getContext(path: string[]): string {
  if (path.length >= 3) {
    return path.slice(0, -1).join(".");
  }
  return path.join(".");
}
