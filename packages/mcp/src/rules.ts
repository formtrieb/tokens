/**
 * Where the design rules of a check come from: the `rules` argument, a
 * `rules_path`, or `tokens.rules.json` next to the token folder. Not inside
 * it: Tokens Studio takes every JSON file in that folder for a token set.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { parseRules, type DesignRules } from "@formtrieb/tokens-core";

export const RULES_FILE = "tokens.rules.json";

export interface LoadedRules {
  rules?: DesignRules;
  /** `"argument"`, the file read, or `"none"`. */
  source: string;
}

function readRules(file: string): DesignRules {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`${file} is no valid JSON: ${(e as Error).message}`);
  }
  return parseRules(data, file);
}

export function loadRules(args: { rules?: unknown; rules_path?: string }, tokensPath: string): LoadedRules {
  if (args.rules !== undefined) return { rules: parseRules(args.rules, "rules"), source: "argument" };
  if (args.rules_path) return { rules: readRules(resolve(args.rules_path)), source: resolve(args.rules_path) };

  const folder = realpathSync(resolve(tokensPath));
  const parent = dirname(folder);
  const file = resolve(parent, RULES_FILE);
  if (!existsSync(file)) return { source: "none" };
  // the file must lie in the parent folder itself, also after resolving links
  const real = realpathSync(file);
  const rel = relative(parent, real);
  if (rel !== basename(rel) || rel.startsWith("..") || isAbsolute(rel) || rel.includes(sep)) return { source: "none" };
  return { rules: readRules(real), source: real };
}
