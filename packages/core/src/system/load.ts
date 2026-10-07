import { parseThemes, type RawTheme } from "../theme/themes.js";
import type { TokenProblem, TokenSystem } from "./types.js";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The sets a token system has: those `$metadata.json` lists (its
 * `tokenSetOrder`, in that order), then those a theme in `$themes.json` names.
 * A set is what these two name, nothing else. Pure: a loader reads exactly
 * these files (`${set}.json`) besides the two index files.
 */
export function namedSets(metadata: unknown, themes: unknown): string[] {
  const named: string[] = [];
  const add = (set: unknown) => {
    if (typeof set === "string" && !named.includes(set)) named.push(set);
  };
  if (isObject(metadata) && Array.isArray(metadata.tokenSetOrder)) metadata.tokenSetOrder.forEach(add);
  if (Array.isArray(themes)) {
    for (const theme of themes) if (isObject(theme) && isObject(theme.selectedTokenSets)) Object.keys(theme.selectedTokenSets).forEach(add);
  }
  return named;
}

/**
 * A token system from the files of a Tokens-Studio export. Keys are paths
 * relative to the export's root as on disk (`$themes.json`,
 * `Foundation/Colors.json`); a set's name is its path without `.json`.
 *
 * The sets are those {@link namedSets} names, in that order; a named set
 * without a file is reported and left out. A file no index names is no set.
 */
export function buildTokenSystem(files: ReadonlyMap<string, unknown>): { system: TokenSystem; problems: TokenProblem[] } {
  const problems: TokenProblem[] = [];
  const rawThemes = files.get("$themes.json");
  const themes = Array.isArray(rawThemes) ? parseThemes(rawThemes as RawTheme[]) : [];

  const order: string[] = [];
  const sets = new Map<string, Record<string, unknown>>();
  for (const set of namedSets(files.get("$metadata.json"), rawThemes)) {
    const json = files.get(`${set}.json`);
    if (isObject(json)) {
      order.push(set);
      sets.set(set, json);
    } else {
      problems.push({ kind: "missing-set", set });
    }
  }
  return { system: { order, sets, themes }, problems };
}
