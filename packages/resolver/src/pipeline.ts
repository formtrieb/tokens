import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  deriveRenderTable,
  renderBundle,
  renderImports,
  renderTokenMap,
  renderUtilities,
  renderVariables,
  type RenderOptions,
  type RenderRule,
  type TokenSystem,
} from '@formtrieb/tokens-render';
import { validateConfig } from './build/validate-config.js';
import { loadTokenSystem } from './load-system.js';
import type { Config } from './types.js';

export type PipelineStep =
  | 'themes'
  | 'utilities'
  | 'imports'
  | 'token-map'
  | 'bundle';

export interface RunOptions {
  only?: PipelineStep[];
}

const ALL_STEPS: PipelineStep[] = ['themes', 'utilities', 'imports', 'token-map', 'bundle'];

/** The render table: `config.render` (rules or a JSON file of rules), else derived from `$themes.json`. */
export async function renderTable(config: Config, system: TokenSystem): Promise<RenderRule[]> {
  if (Array.isArray(config.render)) return config.render;
  if (typeof config.render === 'string') {
    return JSON.parse(await readFile(resolve(config.render), 'utf-8')) as RenderRule[];
  }
  return deriveRenderTable(system.themes, config);
}

async function write(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, 'utf-8');
}

const LOCAL_IMPORT = /^@import\s+['"](.+?)['"];/;

/**
 * Builds everything in memory with @formtrieb/tokens-render, then writes the
 * requested steps. Nothing is written when a value is no valid CSS.
 */
export async function runPipeline(config: Config, options: RunOptions = {}): Promise<void> {
  await validateConfig(config);
  const steps = options.only ?? ALL_STEPS;
  const out = config.paths.output;

  const system = await loadTokenSystem(config.paths.tokens);
  const renderOptions: RenderOptions = {
    prefix: config.prefix,
    basePxFontSize: 16,
    privateTokenPrefixes: config.privateTokenPrefixes ?? ['*'],
    typography: config.typography ?? {},
  };

  const variables = renderVariables(system, await renderTable(config, system), renderOptions);
  const utilities = await renderUtilities(system, config.utilities ?? [], renderOptions, config);
  const mainPath = join(out, 'main.css');
  const existingMain = existsSync(mainPath) ? await readFile(mainPath, 'utf-8') : undefined;
  const main = renderImports([...variables.keys(), ...utilities.keys()], existingMain).get('main.css')!;

  if (steps.includes('themes')) {
    for (const [file, css] of variables) await write(join(out, file), css);
    console.log(`✓ ${variables.size} variable files`);
  }

  if (steps.includes('utilities') && utilities.size > 0) {
    // Stale files from a removed builder would otherwise still be imported.
    await rm(join(out, 'utilities'), { recursive: true, force: true });
    for (const [file, css] of utilities) await write(join(out, file), css);
    console.log(`✓ ${utilities.size} utility files`);
  }

  if (steps.includes('imports')) {
    await write(mainPath, main);
    console.log('✓ main.css (hand-written imports kept)');
  }

  if (steps.includes('token-map')) {
    await write(config.paths.tokenMap, renderTokenMap(system, renderOptions).get('token-map.json')!);
    console.log('✓ token-map.json');
  }

  if (steps.includes('bundle') && config.output?.bundle !== false) {
    const source = steps.includes('imports') ? main : await readFile(mainPath, 'utf-8');
    const files = new Map<string, string>([...variables, ...utilities, ['main.css', source]]);
    // Hand-written imports (reset.css, fonts.css, …) are inlined from disk.
    for (const line of source.split('\n')) {
      const path = LOCAL_IMPORT.exec(line.trim())?.[1].replace(/^\.\//, '');
      if (path && !files.has(path) && existsSync(join(out, path))) {
        files.set(path, await readFile(join(out, path), 'utf-8'));
      }
    }
    await write(join(out, 'bundle.css'), renderBundle(files).get('bundle.css')!);
    console.log('✓ bundle.css');
  }
}
