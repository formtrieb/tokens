import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { walkTokens } from './token-tree.js';
import type { Token } from '../types.js';

async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('$')) continue; // skip $themes.json, $metadata.json
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else if (entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

export async function loadAllTokens(tokensDir: string): Promise<Token[]> {
  const files = await walkDir(tokensDir);
  const all: Token[] = [];
  for (const file of files) {
    const content = JSON.parse(await readFile(file, 'utf-8'));
    all.push(...walkTokens(content));
  }
  return all;
}
