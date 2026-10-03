import type { RawToken, TokenExtensions } from "../types.js";

export class TokenTree {
  private sets: Map<string, Record<string, unknown>>;
  private tokenSetOrder: string[];

  constructor(
    sets: Map<string, Record<string, unknown>>,
    tokenSetOrder: string[]
  ) {
    this.sets = sets;
    this.tokenSetOrder = tokenSetOrder;
  }

  flattenSet(setName: string): RawToken[] {
    const data = this.sets.get(setName);
    if (!data) return [];

    const tokens: RawToken[] = [];
    this.walkObject(data, [], setName, false, tokens);
    return tokens;
  }

  buildMergedTree(
    enabledSets: string[],
    sourceSets: string[]
  ): Map<string, RawToken> {
    const merged = new Map<string, RawToken>();

    // Process in metadata order: source sets first, then enabled sets
    for (const setName of this.tokenSetOrder) {
      if (sourceSets.includes(setName)) {
        const tokens = this.flattenSet(setName);
        for (const token of tokens) {
          token.isSource = true;
          merged.set(token.dotPath, token);
        }
      }
    }

    // Enabled sets override source sets for the same path
    for (const setName of this.tokenSetOrder) {
      if (enabledSets.includes(setName)) {
        const tokens = this.flattenSet(setName);
        for (const token of tokens) {
          token.isSource = false;
          merged.set(token.dotPath, token);
        }
      }
    }

    return merged;
  }

  countTokensInSet(setName: string): number {
    return this.flattenSet(setName).length;
  }

  getTokenSetOrder(): string[] {
    return this.tokenSetOrder;
  }

  private walkObject(
    obj: Record<string, unknown>,
    path: string[],
    sourceSet: string,
    isSource: boolean,
    result: RawToken[]
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;

      const currentPath = [...path, key];

      if (this.isTokenNode(value)) {
        const node = value as Record<string, unknown>;
        result.push({
          path: currentPath,
          dotPath: currentPath.join("."),
          $type: node.$type as string,
          $value: node.$value,
          $extensions: node.$extensions as TokenExtensions | undefined,
          sourceSet,
          isSource,
        });
      } else if (typeof value === "object" && value !== null) {
        this.walkObject(
          value as Record<string, unknown>,
          currentPath,
          sourceSet,
          isSource,
          result
        );
      }
    }
  }

  private isTokenNode(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return "$value" in obj && "$type" in obj;
  }
}
