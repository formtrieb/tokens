import { alignType } from "../canonicalize/index.js";
import type { ThemeDefinition } from "../types.js";
import type { Dictionary, DictionaryEntry, SetSelection, TokenProblem, TokenSystem } from "./types.js";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** A token node: an object with its own `$value`. */
export const isTokenNode = (v: unknown): v is Json => isObject(v) && Object.hasOwn(v, "$value");

interface Group {
  kind: "group";
  type?: string;
  children: Map<string, Group | Token>;
}

interface Token {
  kind: "token";
  node: Json;
  set: string;
  emitted: boolean;
}

/**
 * Merge one set into the tree. Groups merge; a token replaces whatever stood
 * at its path, as a whole. A Map keeps a key at the position it first had.
 */
function merge(group: Group, json: Json, path: string[], set: string, emitted: boolean, problems: TokenProblem[]): void {
  if (typeof json.$type === "string") group.type = json.$type;
  for (const [key, value] of Object.entries(json)) {
    if (key.startsWith("$") || !isObject(value)) continue;
    const at = [...path, key];
    const current = group.children.get(key);
    if (isTokenNode(value)) {
      if (current?.kind === "group") problems.push({ kind: "node-conflict", path: at.join("."), set });
      group.children.set(key, { kind: "token", node: value, set, emitted });
    } else {
      let child = current;
      if (child?.kind !== "group") {
        if (child) problems.push({ kind: "node-conflict", path: at.join("."), set });
        child = { kind: "group", children: new Map() };
        group.children.set(key, child);
      }
      merge(child, value, at, set, emitted, problems);
    }
  }
}

function flatten(
  group: Group,
  path: string[],
  inherited: string | undefined,
  entries: DictionaryEntry[],
  groups: Set<string>,
  problems: TokenProblem[]
): void {
  const groupType = group.type ?? inherited;
  for (const [key, child] of group.children) {
    const at = [...path, key];
    if (child.kind === "group") {
      groups.add(at.join("."));
      flatten(child, at, groupType, entries, groups, problems);
      continue;
    }
    const { node, set, emitted } = child;
    const type = typeof node.$type === "string" ? node.$type : groupType;
    if (type === undefined) problems.push({ kind: "untyped-token", path: at.join("."), set });
    entries.push({
      key: at.join("."),
      path: at,
      ...(type !== undefined && { type, alignedType: alignType(type) }),
      value: structuredClone(node.$value),
      ...(isObject(node.$extensions) && { extensions: structuredClone(node.$extensions) }),
      ...(typeof node.$description === "string" && { description: node.$description }),
      set,
      emitted,
    });
  }
}

/**
 * The tokens a selection of sets yields: its `source` sets, then its
 * `enabled` sets, each in the selection's order, merged. Groups merge, a
 * token replaces a token as a whole. A group's `$type` reaches every token
 * below it in the merged tree that has none of its own.
 */
export function compose(system: TokenSystem, selection: SetSelection): Dictionary {
  const problems: TokenProblem[] = [];
  const root: Group = { kind: "group", children: new Map() };
  for (const state of ["source", "enabled"] as const) {
    for (const item of selection) {
      if (item.state !== state) continue;
      const json = system.sets.get(item.set);
      if (!json) {
        problems.push({ kind: "missing-set", set: item.set });
        continue;
      }
      merge(root, json, [], item.set, state === "enabled", problems);
    }
  }
  const entries: DictionaryEntry[] = [];
  const groups = new Set<string>();
  flatten(root, [], undefined, entries, groups, problems);
  return { entries, byKey: new Map(entries.map((e) => [e.key, e])), groups, problems };
}

/** The selection of a theme, in the order `$themes.json` lists its sets. */
export function themeSelection(theme: ThemeDefinition): SetSelection {
  return Object.entries(theme.selectedTokenSets)
    .filter(([, state]) => state === "source" || state === "enabled")
    .map(([set, state]) => ({ set, state }));
}

/** The dictionary of one theme, given as definition or as id `group/name`. */
export function composeTheme(system: TokenSystem, theme: ThemeDefinition | string): Dictionary {
  const definition = typeof theme === "string" ? system.themes.find((t) => `${t.group}/${t.name}` === theme) : theme;
  if (!definition) throw new Error(`no theme "${theme as string}" in $themes.json`);
  return compose(system, themeSelection(definition));
}
