import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { buildTokenSystem, namedSets, type TokenSystem } from '@formtrieb/tokens-core';

function readJson(file: string, name: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (e) {
    throw new Error(`Token file ${name} is no valid JSON: ${(e as Error).message}`);
  }
}

/**
 * The files of a token folder as core's `buildTokenSystem` takes them:
 * `$metadata.json`, `$themes.json`, and the set files these two name (core's
 * `namedSets`) — nothing else. Every file read must lie inside the folder
 * after resolving symbolic links; a set name that leaves it is not read and
 * core reports it as missing.
 */
function readTokenFiles(tokensPath: string): Map<string, unknown> {
  const root = realpathSync(resolve(tokensPath));
  const inside = (name: string): string | undefined => {
    const file = resolve(root, ...name.split('/'));
    if (!existsSync(file)) return undefined;
    const real = realpathSync(file);
    const rel = relative(root, real);
    return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? undefined : real;
  };
  const files = new Map<string, unknown>();
  for (const name of ['$metadata.json', '$themes.json']) {
    const file = inside(name);
    if (file) files.set(name, readJson(file, name));
  }
  for (const set of namedSets(files.get('$metadata.json'), files.get('$themes.json'))) {
    const file = inside(`${set}.json`);
    if (file) files.set(`${set}.json`, readJson(file, `${set}.json`));
  }
  return files;
}

/**
 * A Tokens-Studio export read into memory. Reading is all this does; which
 * sets there are and in which order is core's `buildTokenSystem`. A set that
 * `$metadata.json` or a theme names without a file is reported.
 */
export async function loadTokenSystem(dir: string): Promise<TokenSystem> {
  const files = readTokenFiles(dir);
  if (!files.has('$themes.json')) throw new Error(`No $themes.json in ${dir}.`);
  const { system, problems } = buildTokenSystem(files);
  for (const p of problems) if (p.kind === 'missing-set') console.warn(`⚠ token set "${p.set}" is named but has no file in ${dir}.`);
  return system;
}
