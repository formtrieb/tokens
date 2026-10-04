/**
 * The token dictionary of one theme, built the way today's output was built:
 * the theme's `source` sets, then its `enabled` sets, each in `$themes.json`
 * order, deep-merged (a later set overrides, a key keeps its first
 * position), Tokens-Studio types aligned, then flattened in object order.
 *
 * The order of sets comes from the theme alone. Nothing here knows a set.
 */
import { alignType } from "@formtrieb/tokens-core";
import type { ThemeDefinition } from "@formtrieb/tokens-core";
import type { TokenSystem } from "../types.js";

export type Json = Record<string, unknown>;

export interface Entry {
  /** dot path, `colors.neutral.1` */
  key: string;
  path: string[];
  /** aligned type (`dimension`, `fontSize`, `shadow`, …) */
  type?: string;
  /** Tokens Studio type before alignment, when it differed */
  originalType?: string;
  /** `$value` after preprocessing, before resolution — what SD calls `original` */
  original: unknown;
  /** `$extensions['studio.tokens'].modify`, before resolution */
  modify?: Json;
  description?: string;
  /** from an `enabled` set, i.e. written to this theme's block */
  isSource: boolean;
}

export interface Dictionary {
  entries: Entry[];
  byKey: Map<string, Entry>;
  /** merged tree, for path lookups that may hit a group */
  tree: Json;
}

const isPlain = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const isToken = (v: unknown): v is Json => isPlain(v) && Object.hasOwn(v, "$value");

/** Tag every token of a set with where it came from. */
function tag(node: Json, isSource: boolean): void {
  for (const value of Object.values(node)) {
    if (isToken(value)) value.isSource = isSource;
    else if (isPlain(value)) tag(value, isSource);
  }
}

/** Style Dictionary's deepExtend: objects merge, everything else is replaced. */
function extend(target: Json, source: Json): Json {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (isPlain(value) && isPlain(current)) extend(current, value);
    else target[key] = isPlain(value) ? extend({}, value) : structuredClone(value);
  }
  return target;
}

/** A group's `$type` reaches every token below it that has none of its own. */
function delegateTypes(node: Json, inherited?: unknown): void {
  let type = inherited;
  if (!Object.hasOwn(node, "$type") && type && Object.hasOwn(node, "$value")) node.$type = type;
  if (node.$type) {
    type = node.$type;
    if (node.$value === undefined) delete node.$type;
  }
  for (const value of Object.values(node)) if (isPlain(value)) delegateTypes(value, type);
}

const SHADOW_PROPS: Record<string, string> = { x: "offsetX", y: "offsetY" };

/** The `tokens-studio` preprocessor's type alignment, including shadow `x`/`y`. */
function alignTypes(node: Json): void {
  if (isToken(node)) {
    const type = node.$type as string | undefined;
    const aligned = alignType(type);
    if (aligned !== type) {
      node.$type = aligned;
      const ext = (node.$extensions ?? {}) as Json;
      node.$extensions = { ...ext, "studio.tokens": { ...((ext["studio.tokens"] as Json) ?? {}), originalType: type } };
    }
    if (aligned === "shadow" && typeof node.$value === "object" && node.$value !== null) {
      const rename = (o: Json) => {
        for (const [from, to] of Object.entries(SHADOW_PROPS)) {
          if (o[from] !== undefined) {
            o[to] = o[from];
            delete o[from];
          }
        }
      };
      if (Array.isArray(node.$value)) node.$value.forEach((s) => isPlain(s) && rename(s));
      else if (isPlain(node.$value)) rename(node.$value);
    }
    return;
  }
  for (const value of Object.values(node)) if (typeof value === "object" && value !== null) alignTypes(value as Json);
}

function flatten(node: Json, path: string[], out: Entry[]): void {
  for (const [key, value] of Object.entries(node)) {
    if (!isPlain(value)) continue;
    if (Object.hasOwn(value, "$value")) {
      const ext = value.$extensions as Json | undefined;
      const studio = ext?.["studio.tokens"] as Json | undefined;
      const p = [...path, key];
      out.push({
        key: p.join("."),
        path: p,
        type: value.$type as string | undefined,
        ...(studio?.originalType !== undefined && { originalType: studio.originalType as string }),
        original: structuredClone(value.$value),
        ...(studio?.modify !== undefined && { modify: structuredClone(studio.modify as Json) }),
        ...(typeof value.$description === "string" && { description: value.$description }),
        isSource: value.isSource === true,
      });
    } else {
      flatten(value, [...path, key], out);
    }
  }
}

export function findTheme(system: TokenSystem, id: string): ThemeDefinition {
  const theme = system.themes.find((t) => `${t.group}/${t.name}` === id);
  if (!theme) throw new Error(`render: no theme "${id}" in $themes.json`);
  return theme;
}

export function buildDictionary(system: TokenSystem, theme: ThemeDefinition): Dictionary {
  const entries = Object.entries(theme.selectedTokenSets);
  const include = entries.filter(([, state]) => state === "source").map(([set]) => set);
  const source = entries.filter(([, state]) => state === "enabled").map(([set]) => set);

  const tree: Json = {};
  for (const [sets, isSource] of [[include, false], [source, true]] as const) {
    for (const set of sets) {
      const content = system.sets.get(set);
      if (!content) continue;
      const copy = structuredClone(content);
      tag(copy, isSource);
      extend(tree, copy);
    }
  }
  delegateTypes(tree);
  alignTypes(tree);

  const list: Entry[] = [];
  flatten(tree, [], list);
  return { entries: list, byKey: new Map(list.map((e) => [e.key, e])), tree };
}
