import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildAxisMap,
  buildTokenSystem,
  type Dictionary,
  type DictionaryEntry,
  type Resolution,
  type ThemeDefinition,
  type TokenProblem,
  type TokenSystem,
} from "@formtrieb/tokens-core";
import { readTokenFiles } from "./loader/token-loader.js";
import { resolveTokensPath } from "./path-resolver.js";

/** One composed and resolved set selection. */
export interface Composition {
  dict: Dictionary;
  values: ReadonlyMap<string, Resolution>;
}

export interface TokenContext {
  system: TokenSystem;
  /** Problems found while loading (a set named but without a file). */
  loadProblems: TokenProblem[];
  axisMap: Map<string, ThemeDefinition[]>;
  lastMtime: number;
  /** Compositions by set selection (JSON of the ordered selection), least recently used first. */
  compositions: Map<string, Composition>;
  /** Each set's tokens read on their own, unresolved (browse, validation). */
  setEntries: Map<string, DictionaryEntry[]>;
}

interface CacheEntry {
  ctx: TokenContext;
  fileCount: number;
}

const MAX_CACHE_SIZE = 8;
const cache = new Map<string, CacheEntry>();

interface TreeFingerprint {
  maxMtime: number;
  fileCount: number;
}

function computeFingerprint(dir: string): TreeFingerprint {
  const entries = readdirSync(dir, { recursive: true });
  let maxMtime = 0;
  let fileCount = 0;
  for (const entry of entries) {
    const name = typeof entry === "string" ? entry : entry.toString();
    if (!name.endsWith(".json")) continue;
    fileCount++;
    const stat = statSync(join(dir, name));
    if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
  }
  return { maxMtime, fileCount };
}

export function getTokenContext(absolutePath: string): TokenContext {
  const cached = cache.get(absolutePath);
  const fp = computeFingerprint(absolutePath);
  if (
    cached &&
    cached.ctx.lastMtime === fp.maxMtime &&
    cached.fileCount === fp.fileCount
  ) {
    cache.delete(absolutePath);
    cache.set(absolutePath, cached);
    return cached.ctx;
  }
  if (cached) cache.delete(absolutePath);

  const { system, problems } = buildTokenSystem(readTokenFiles(absolutePath));
  const ctx: TokenContext = {
    system,
    loadProblems: problems,
    axisMap: buildAxisMap(system.themes),
    lastMtime: fp.maxMtime,
    compositions: new Map(),
    setEntries: new Map(),
  };
  cache.set(absolutePath, { ctx, fileCount: fp.fileCount });
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return ctx;
}

export function _clearCacheForTesting(): void {
  cache.clear();
}

export const TOKENS_PATH_DESCRIPTION =
  "Optional absolute path to the tokens directory (containing $metadata.json). Leave empty to auto-detect by walking up from the current working directory.";

export function resolveAndLoad(args: { tokens_path?: string }): TokenContext {
  const { path } = resolveTokensPath(args, {
    cwd: process.cwd(),
  });
  return getTokenContext(path);
}
