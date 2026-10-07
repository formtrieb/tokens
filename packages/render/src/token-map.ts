/**
 * `token-map.json`: Figma path → CSS variable, for everything a theme
 * writes (sets that are `enabled` somewhere), typography companions
 * included when the options write them. The Figma path keeps source casing (`zIndex/base`); the
 * variable kebab-cases each segment (`--ds-z-index-base`).
 */
import { kebab } from "./kebab.js";
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

function collect(node: unknown, path: string[], options: ResolvedRenderOptions, out: Record<string, string>): void {
  if (node === null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const cssVar = (p: string[]) => `--${options.prefix}${p.map((seg) => kebab(seg)).join("-")}`;

  if ("$type" in obj && "$value" in obj) {
    if (isPrivate(path, options.privateTokenPrefixes)) return;
    out[path.join("/")] = cssVar(path);
    const value = obj.$value;
    if (options.typographyCompanions && obj.$type === "typography" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [field, segment] of TYPOGRAPHY_COMPANIONS) {
        if (!(value as Record<string, unknown>)[field]) continue;
        const p = [...path, segment];
        out[p.join("/")] = cssVar(p);
      }
    }
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    collect(value, [...path, key], options, out);
  }
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
  const enabled = new Set<string>();
  for (const theme of system.themes) {
    for (const [set, state] of Object.entries(theme.selectedTokenSets)) if (state === "enabled") enabled.add(set);
  }
  const figmaToCSS: Record<string, string> = {};
  for (const set of enabled) {
    const content = system.sets.get(set);
    if (content) collect(content, [], options, figmaToCSS);
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
