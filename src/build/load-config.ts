import { access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from '../types.js';

const FILENAMES = [
  'formtrieb-tokens.config.ts',
  'formtrieb-tokens.config.mjs',
  'formtrieb-tokens.config.js',
];

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    for (const name of FILENAMES) {
      const full = join(dir, name);
      if (await exists(full)) return full;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadConfig(path: string): Promise<Config> {
  const url = pathToFileURL(path).href;
  const mod = await import(url);
  if (!mod.default) {
    throw new Error(`Config file ${path} must have a default export.`);
  }
  return mod.default as Config;
}
