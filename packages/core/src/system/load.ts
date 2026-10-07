import { parseThemes, type RawTheme } from "../theme/theme-resolver.js";
import type { TokenProblem, TokenSystem } from "./types.js";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A token system from the files of a Tokens-Studio export. Keys are paths
 * relative to the export's root as on disk (`$themes.json`,
 * `Foundation/Colors.json`); a set's name is its path without `.json`. A path
 * with a segment starting with `$` or `.` is no set.
 *
 * Set order: `$metadata.json`'s `tokenSetOrder`, then sets a theme names,
 * then the remaining set files by path. A set named there without a file is
 * reported and left out.
 */
export function buildTokenSystem(files: ReadonlyMap<string, unknown>): { system: TokenSystem; problems: TokenProblem[] } {
  const problems: TokenProblem[] = [];
  const sets = new Map<string, Record<string, unknown>>();
  for (const [path, json] of [...files].sort(([a], [b]) => byCodeUnit(a, b))) {
    if (!path.endsWith(".json") || path.split("/").some((s) => s.startsWith("$") || s.startsWith("."))) continue;
    if (isObject(json)) sets.set(path.slice(0, -".json".length), json);
  }

  const rawThemes = files.get("$themes.json");
  const themes = Array.isArray(rawThemes) ? parseThemes(rawThemes as RawTheme[]) : [];
  const meta = files.get("$metadata.json");
  const metaOrder = isObject(meta) && Array.isArray(meta.tokenSetOrder) ? (meta.tokenSetOrder as unknown[]) : [];

  const named: string[] = [];
  const name = (set: string) => {
    if (!named.includes(set)) named.push(set);
  };
  for (const set of metaOrder) if (typeof set === "string") name(set);
  for (const theme of themes) for (const set of Object.keys(theme.selectedTokenSets)) name(set);

  const order: string[] = [];
  for (const set of named) {
    if (sets.has(set)) order.push(set);
    else problems.push({ kind: "missing-set", set });
  }
  for (const set of sets.keys()) if (!order.includes(set)) order.push(set);

  return { system: { order, sets, themes }, problems };
}
