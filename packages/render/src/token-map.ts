/**
 * `token-map.json`: Figma path → CSS variable, for everything a theme
 * writes (tokens of its `enabled` sets, types as the composed theme has
 * them, so a group's `$type` counts), typography companions
 * included when the options write them. The Figma path keeps source casing (`zIndex/base`); the
 * variable kebab-cases each segment (`--ds-z-index-base`).
 */
import { kebab } from "./kebab.js";
import { composeTheme } from "@formtrieb/tokens-core";
import type { ResolvedRenderOptions, TokenSystem } from "./types.js";

const TYPOGRAPHY_COMPANIONS: [string, string][] = [
  ["letterSpacing", "letterSpacing"],
  ["textCase", "textTransform"],
  ["textDecoration", "textDecoration"],
  ["paragraphIndent", "textIndent"],
  ["paragraphSpacing", "marginBlockEnd"],
];

const EXPAND_THRESHOLD = 100;
const MAX_DEPTH = 4;

function isPrivate(path: string[], prefixes: string[]): boolean {
  return path.some((segment) => prefixes.some((p) => segment.startsWith(p)));
}

/** Token paths of a set in source order; a token node is an object with its own `$value`. */
function paths(node: unknown, at: string[], out: string[][]): void {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  if (Object.hasOwn(node, "$value")) {
    out.push(at);
    return;
  }
  for (const [key, value] of Object.entries(node)) if (!key.startsWith("$")) paths(value, [...at, key], out);
}

/** Orientation for a reader: counts per category, deeper where a bucket is large. */
function categories(paths: string[], depth: number, out: Record<string, number>): void {
  const grouped: Record<string, string[]> = {};
  for (const path of paths) (grouped[path.split("/").slice(0, depth).join("/")] ??= []).push(path);
  for (const [key, group] of Object.entries(grouped)) {
    const expand = group.length > EXPAND_THRESHOLD && depth < MAX_DEPTH && group.some((p) => p.split("/").length > depth);
    if (expand) categories(group, depth + 1, out);
    else out[key] = group.length;
  }
}

export function tokenMap(system: TokenSystem, options: ResolvedRenderOptions): string {
  const cssVar = (p: string[]) => `--${options.prefix}${p.map((seg) => kebab(seg)).join("-")}`;
  const figmaToCSS: Record<string, string> = {};
  for (const theme of system.themes) {
    const enabled = Object.entries(theme.selectedTokenSets).filter(([, state]) => state === "enabled").map(([set]) => set);
    if (enabled.length === 0) continue;
    // What the theme writes, with types as the theme sees them (a group's $type included).
    const dict = composeTheme(system, theme);
    for (const set of enabled) {
      const found: string[][] = [];
      paths(system.sets.get(set), [], found);
      for (const path of found) {
        const entry = dict.byKey.get(path.join("."));
        if (!entry?.emitted || isPrivate(path, options.privateTokenPrefixes)) continue;
        figmaToCSS[path.join("/")] = cssVar(path);
        const value = entry.value;
        if (options.typographyCompanions && entry.alignedType === "typography" && value !== null && typeof value === "object" && !Array.isArray(value)) {
          for (const [field, segment] of TYPOGRAPHY_COMPANIONS) {
            if (!(value as Record<string, unknown>)[field]) continue;
            const p = [...path, segment];
            figmaToCSS[p.join("/")] = cssVar(p);
          }
        }
      }
    }
  }
  const counts: Record<string, number> = {};
  categories(Object.keys(figmaToCSS), 1, counts);
  const map = {
    prefix: `--${options.prefix}`,
    count: Object.keys(figmaToCSS).length,
    transform: `Each Figma path becomes a CSS variable: kebab-case each segment then join with '-' and prepend '--${options.prefix}'.`,
    categories: counts,
    figmaToCSS,
  };
  return JSON.stringify(map, null, 2);
}
