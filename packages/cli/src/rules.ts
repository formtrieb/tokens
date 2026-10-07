/**
 * Where the design rules of a check come from: `--rules`, or
 * `tokens.rules.json` next to the token folder. Not inside it: Tokens Studio
 * takes every JSON file in that folder for a token set. The MCP server finds
 * its rules the same way.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseRules, type DesignRules } from '@formtrieb/tokens-core';

export const RULES_FILE = 'tokens.rules.json';

export interface LoadedRules {
  rules?: DesignRules;
  /** The file read, or `"none"`. */
  source: string;
}

function readRules(file: string): DesignRules {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (e) {
    throw new Error(`${file} is no valid JSON: ${(e as Error).message}`);
  }
  return parseRules(data, file);
}

export function loadRules(rulesPath: string | undefined, tokensPath: string): LoadedRules {
  if (rulesPath) return { rules: readRules(resolve(rulesPath)), source: resolve(rulesPath) };
  const parent = dirname(realpathSync(resolve(tokensPath)));
  const file = resolve(parent, RULES_FILE);
  if (!existsSync(file)) return { source: 'none' };
  // the file must lie in the parent folder itself, also after resolving links
  const real = realpathSync(file);
  const rel = relative(parent, real);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel) || rel.includes(sep)) return { source: 'none' };
  return { rules: readRules(real), source: real };
}
