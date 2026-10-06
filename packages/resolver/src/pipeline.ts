import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  deriveRenderTable,
  parseRenderFile,
  renderBundle,
  renderImports,
  renderTokenMap,
  renderUtilities,
  renderVariables,
  type RenderFileOptions,
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

/**
 * The render table and the output options that came with it: `config.render`
 * (rules, or a render file that may carry options), else derived from
 * `$themes.json` without options.
 */
export async function renderSource(
  config: Config,
  system: TokenSystem
): Promise<{ rules: RenderRule[]; options: RenderFileOptions }> {
  if (Array.isArray(config.render)) return { rules: config.render, options: {} };
  if (typeof config.render === 'string') {
    const path = resolve(config.render);
    return parseRenderFile(JSON.parse(await readFile(path, 'utf-8')), config.render);
  }
  return { rules: deriveRenderTable(system.themes, config), options: {} };
}

/** Options where the config overriding the render file changes the output for the tree's producer. */
const WARN_ON_OVERRIDE = ['dialect', 'basePxFontSize'] as const;

/** Config > render file > render's defaults, per option; warns where the config overrides the file. */
function outputOptions(config: Config, file: RenderFileOptions): RenderOptions {
  for (const key of WARN_ON_OVERRIDE) {
    if (config[key] !== undefined && file[key] !== undefined && config[key] !== file[key]) {
      console.warn(
        `⚠ ${config.render} says ${key} ${JSON.stringify(file[key])}, the config sets ` +
          `${JSON.stringify(config[key])}; using the config.`
      );
    }
  }
  return {
    prefix: config.prefix,
    dialect: config.dialect ?? file.dialect,
    basePxFontSize: config.basePxFontSize ?? file.basePxFontSize,
    units: config.units ?? file.units,
    color: config.color ?? file.color,
    privateTokenPrefixes: config.privateTokenPrefixes ?? ['*'],
    typography: config.typography ?? {},
  };
}

async function write(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, 'utf-8');
}

/**
 * `.css` files directly in `variables/` and `utilities/` that this run did not
 * render. `main.css` imports only what was rendered, so nothing imports them.
 */
async function leftovers(out: string, rendered: Iterable<string>): Promise<string[]> {
  const known = new Set(rendered);
  const found: string[] = [];
  for (const dir of ['variables', 'utilities']) {
    const entries = await readdir(join(out, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const file = `${dir}/${entry.name}`;
      if (entry.isFile() && entry.name.endsWith('.css') && !known.has(file)) found.push(file);
    }
  }
  return found.sort();
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
  const table = await renderSource(config, system);
  const renderOptions = outputOptions(config, table.options);

  const variables = renderVariables(system, table.rules, renderOptions);
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
    const stale = await leftovers(out, [...variables.keys(), ...utilities.keys()]);
    if (stale.length > 0) {
      console.warn(
        `⚠ ${stale.length} file(s) in ${out} not rendered and not imported by main.css — ` +
          'check that nothing still reads from them, then delete them:\n' +
          stale.map((f) => `  ${f}`).join('\n')
      );
    }
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
