import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseThemes } from '@formtrieb/tokens-core';
import type { TokenSystem } from '@formtrieb/tokens-render';

async function jsonFiles(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name.startsWith('$') || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsonFiles(full, root)));
    else if (entry.name.endsWith('.json')) out.push(relative(root, full).split('\\').join('/').replace(/\.json$/, ''));
  }
  return out;
}

/**
 * A Tokens-Studio export read into memory: `$themes.json`, and every set —
 * in `$metadata.json` order, then any set a theme names, then any other
 * set file in the directory.
 */
export async function loadTokenSystem(dir: string): Promise<TokenSystem> {
  const metaFile = join(dir, '$metadata.json');
  const meta = existsSync(metaFile) ? JSON.parse(await readFile(metaFile, 'utf-8')) : {};
  const themes = parseThemes(JSON.parse(await readFile(join(dir, '$themes.json'), 'utf-8')));

  const order: string[] = [...(meta.tokenSetOrder ?? [])];
  const add = (set: string) => {
    if (!order.includes(set)) order.push(set);
  };
  for (const theme of themes) for (const set of Object.keys(theme.selectedTokenSets)) add(set);
  for (const set of await jsonFiles(dir)) add(set);

  const sets = new Map<string, Record<string, unknown>>();
  for (const set of order) {
    const file = join(dir, `${set}.json`);
    if (existsSync(file)) sets.set(set, JSON.parse(await readFile(file, 'utf-8')));
  }
  return { order: order.filter((s) => sets.has(s)), sets, themes };
}
