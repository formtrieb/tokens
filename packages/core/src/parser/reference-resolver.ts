import type { ColorModifier, RawToken, ResolutionChain } from "../types.js";
import { evaluateMath, containsMath } from "./math-evaluator.js";
import {
  resolveLchToHex,
  resolveLchToHexWithGamut,
  applyColorModifier,
  isLchFormula,
  isPlainColor,
} from "./color-resolver.js";

const MAX_DEPTH = 50;
const REF_PATTERN = /\{([^}]+)\}/g;
// Non-global twin for tests: a /g regex carries lastIndex from one .test()
// call into the next, which skipped references in composites.
const HAS_REF = /\{[^}]+\}/;

/**
 * State of one resolve() call. `visited` is the current path (cycle check);
 * `memo` holds every token already resolved in this call, so a token reached
 * along many paths is resolved once — a wide reference DAG otherwise costs
 * 2^depth visits. `unrounded` holds a colour token's value before it was
 * rounded to hex — the `lch()` formula, or a modifier's `srgb` output — so the
 * next modifier in a chain starts from the same value the resolver hands on.
 */
interface Walk {
  visited: Set<string>;
  memo: Map<string, unknown>;
  unrounded: Map<string, string>;
}

export class ReferenceResolver {
  private tokenMap: Map<string, RawToken>;
  private cache: Map<string, ResolutionChain> = new Map();

  constructor(tokenMap: Map<string, RawToken>) {
    this.tokenMap = tokenMap;
  }

  resolve(dotPath: string): ResolutionChain {
    const cached = this.cache.get(dotPath);
    if (cached) return cached;

    const chain: ResolutionChain = { steps: [], finalValue: null, errors: [] };
    const walk: Walk = { visited: new Set(), memo: new Map(), unrounded: new Map() };

    this.resolveRecursive(dotPath, chain, walk, 0);

    this.cache.set(dotPath, chain);
    return chain;
  }

  private resolveRecursive(
    dotPath: string,
    chain: ResolutionChain,
    walk: Walk,
    depth: number
  ): unknown {
    if (depth > MAX_DEPTH) {
      chain.errors.push(`Max resolution depth exceeded at "${dotPath}"`);
      return null;
    }

    if (walk.memo.has(dotPath)) return walk.memo.get(dotPath);

    if (walk.visited.has(dotPath)) {
      chain.errors.push(`Circular reference detected at "${dotPath}"`);
      return null;
    }

    const token = this.tokenMap.get(dotPath);
    if (!token) {
      chain.errors.push(`Token not found: "${dotPath}"`);
      return null;
    }

    walk.visited.add(dotPath);

    const modifier = token.$extensions?.["studio.tokens"]?.modify;
    chain.steps.push({
      tokenPath: dotPath,
      rawValue: token.$value,
      sourceSet: token.sourceSet,
      ...(modifier && { modifier }),
    });

    const resolved = this.resolveValue(token, chain, walk, depth);
    chain.finalValue = resolved;

    walk.visited.delete(dotPath);
    walk.memo.set(dotPath, resolved);
    return resolved;
  }

  private resolveValue(
    token: RawToken,
    chain: ResolutionChain,
    walk: Walk,
    depth: number
  ): unknown {
    const value = token.$value;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === "string" && hasReferences(v)) {
          resolved[k] = this.resolveStringValue(v, chain, walk, depth);
        } else {
          resolved[k] = v;
        }
      }
      return resolved;
    }

    if (typeof value === "string") {
      let resolved = this.resolveStringValue(value, chain, walk, depth, true);
      let unrounded = isPureReference(value)
        ? walk.unrounded.get(value.slice(1, -1))
        : undefined;

      if (typeof resolved === "string" && isLchFormula(resolved)) {
        chain.lchValue = resolved;
        unrounded = resolved;
        const result = resolveLchToHexWithGamut(resolved);
        if (result) {
          resolved = result.hex;
          if (result.clipped) chain.gamutClipped = true;
        }
      }

      if (
        token.$extensions?.["studio.tokens"]?.modify &&
        typeof resolved === "string" &&
        isPlainColor(resolved)
      ) {
        const modify = this.resolveModifierValue(
          token.$extensions["studio.tokens"].modify,
          chain,
          walk,
          depth
        );
        // Round once, for output: the modifier works on the unrounded base,
        // and its own unrounded result travels on to the next modifier.
        const base = unrounded ?? resolved;
        const modified = applyColorModifier(base, modify);
        if (modified) resolved = modified;
        unrounded = applyColorModifier(base, modify, "srgb") ?? undefined;
      }

      if (unrounded !== undefined) walk.unrounded.set(token.dotPath, unrounded);
      return resolved;
    }

    return value;
  }

  /**
   * Modifier values may themselves be token references (e.g. an alpha modifier
   * whose multiplier is `{color.text.lightness.multiplier.secondary}`). Resolve
   * any reference in the value against the token map before the modifier is
   * applied — otherwise parseFloat sees a `{...}` literal, yields NaN, and the
   * modifier is silently dropped, leaving the base colour as the final value.
   * The same holds for the target colour of a `mix`.
   */
  private resolveModifierValue(
    modify: ColorModifier,
    chain: ResolutionChain,
    walk: Walk,
    depth: number
  ): ColorModifier {
    const resolveField = (field: string | undefined) =>
      typeof field === "string" && field.includes("{")
        ? String(this.resolveStringValue(field, chain, walk, depth))
        : field;
    return {
      ...modify,
      value: resolveField(modify.value)!,
      ...(modify.color !== undefined && { color: resolveField(modify.color) }),
    };
  }

  private resolveStringValue(
    value: string,
    chain: ResolutionChain,
    walk: Walk,
    depth: number,
    keepLch = false
  ): string | number {
    if (isPureReference(value)) {
      const refPath = value.slice(1, -1);
      const resolved = this.resolveRecursive(refPath, chain, walk, depth + 1);
      if (resolved !== null) return resolved as string | number;
      return value;
    }

    if (hasReferences(value)) {
      let substituted = value.replace(REF_PATTERN, (_match, refPath: string) => {
        const resolved = this.resolveRecursive(
          refPath,
          chain,
          walk,
          depth + 1
        );
        if (resolved !== null) return String(resolved);
        return `{${refPath}}`;
      });

      if (containsMath(substituted)) {
        const mathResult = evaluateMath(substituted);
        if (mathResult !== substituted) {
          substituted = String(mathResult);
        }
      }

      if (!keepLch && isLchFormula(substituted)) {
        chain.lchValue = substituted;
        const result = resolveLchToHexWithGamut(substituted);
        if (result) {
          if (result.clipped) chain.gamutClipped = true;
          return result.hex;
        }
      }

      return substituted;
    }

    if (containsMath(value)) {
      const result = evaluateMath(value);
      return result as string | number;
    }

    return value;
  }
}

function isPureReference(value: string): boolean {
  return /^\{[^}]+\}$/.test(value);
}

function hasReferences(value: string): boolean {
  return typeof value === "string" && HAS_REF.test(value);
}
