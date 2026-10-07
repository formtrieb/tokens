import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildTokenSystem, type TokenSystem } from '@formtrieb/tokens-core';

/** Every `.json` below `dir`, as paths relative to it with `/`. Dot directories are skipped. */
async function jsonFiles(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsonFiles(full, root)));
    else if (entry.name.endsWith('.json')) out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

/**
 * A Tokens-Studio export read into memory. Reading is all this does; which
 * file is a set and in which order sets come is core's `buildTokenSystem`.
 * A set that `$metadata.json` or a theme names without a file is reported.
 */
export async function loadTokenSystem(dir: string): Promise<TokenSystem> {
  const files = new Map<string, unknown>();
  for (const file of await jsonFiles(dir)) files.set(file, JSON.parse(await readFile(join(dir, file), 'utf-8')));
  if (!files.has('$themes.json')) throw new Error(`No $themes.json in ${dir}.`);
  const { system, problems } = buildTokenSystem(files);
  for (const p of problems) if (p.kind === 'missing-set') console.warn(`⚠ token set "${p.set}" is named but has no file in ${dir}.`);
  return system;
}
