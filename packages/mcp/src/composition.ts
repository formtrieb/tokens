/**
 * The one way from theme axes to resolved values: axes → set selection →
 * core's `compose` and `resolveDictionary`, once per selection and cached in
 * the token context.
 */
import {
  compose,
  getThemeByName,
  resolveDictionary,
  type DictionaryEntry,
  type SetSelection,
  type ThemeAxes,
  type TokenSystem,
} from "@formtrieb/tokens-core";
import type { Composition, TokenContext } from "./token-context.js";

const MAX_COMPOSITIONS = 16;

/**
 * The sets a combination of themes reads: a set is `enabled` when a chosen
 * theme enables it, else `source` when one names it as source. Within each
 * state, `$metadata.json` order. `compose` reads all source sets before all
 * enabled sets, so an enabled set wins over a source set.
 */
export function selectionFor(system: TokenSystem, axes: ThemeAxes): SetSelection {
  const state = new Map<string, "source" | "enabled">();
  for (const [group, name] of Object.entries(axes)) {
    const theme = getThemeByName(system.themes, group, name);
    if (!theme) continue;
    for (const [set, s] of Object.entries(theme.selectedTokenSets)) {
      if (s === "enabled") state.set(set, "enabled");
      else if (s === "source" && !state.has(set)) state.set(set, "source");
    }
  }
  const order = [...system.order, ...[...state.keys()].filter((s) => !system.order.includes(s))];
  return order.filter((set) => state.has(set)).map((set) => ({ set, state: state.get(set)! }));
}

/** The composed and resolved selection, computed once per token context. */
export function compositionFor(ctx: TokenContext, selection: SetSelection): Composition {
  const key = JSON.stringify(selection);
  const cached = ctx.compositions.get(key);
  if (cached) {
    ctx.compositions.delete(key);
    ctx.compositions.set(key, cached);
    return cached;
  }
  const dict = compose(ctx.system, selection);
  const composition: Composition = { dict, values: resolveDictionary(dict).values };
  ctx.compositions.set(key, composition);
  if (ctx.compositions.size > MAX_COMPOSITIONS) ctx.compositions.delete(ctx.compositions.keys().next().value!);
  return composition;
}

/** A set's layer: the first segment of its name. */
export function layerOf(set: string): string {
  const parts = set.split("/");
  return parts.length > 1 ? parts[0]! : set;
}

/**
 * The tokens of one set, or of every set of a layer, or of all sets, each set
 * read on its own (not merged): what browse and validation look at. Types are
 * as the set has them, a group's `$type` included.
 */
export function tokensOf(ctx: TokenContext, setOrLayer?: string): DictionaryEntry[] {
  const { system } = ctx;
  const sets = !setOrLayer
    ? system.order
    : system.sets.has(setOrLayer)
      ? [setOrLayer]
      : system.order.filter((s) => layerOf(s) === setOrLayer);
  return sets.flatMap((set) => {
    let entries = ctx.setEntries.get(set);
    if (!entries) ctx.setEntries.set(set, (entries = compose(system, [{ set, state: "enabled" }]).entries));
    return entries;
  });
}

/** A dictionary entry in the shape core's analyzers read (`RawToken`). */
export function asRawToken(entry: DictionaryEntry) {
  return {
    path: entry.path,
    dotPath: entry.key,
    $type: entry.type ?? "",
    $value: entry.value,
    ...(entry.extensions && { $extensions: entry.extensions }),
    sourceSet: entry.set,
    isSource: !entry.emitted,
  };
}
