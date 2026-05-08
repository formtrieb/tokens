import { processAllThemes } from './build/theme-processor.js';
import { runUtilities } from './generators/run-utilities.js';
import { generateCssImports } from './generators/css-imports.js';
import { generateTokenMap } from './generators/token-map.js';
import { bundleCss } from './generators/bundle-css.js';
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

export async function runPipeline(config: Config, options: RunOptions = {}): Promise<void> {
  const steps = options.only ?? ALL_STEPS;

  if (steps.includes('themes')) await processAllThemes(config);
  if (steps.includes('utilities')) await runUtilities(config);
  if (steps.includes('imports')) generateCssImports(config);
  if (steps.includes('token-map')) await generateTokenMap(config);
  if (steps.includes('bundle')) bundleCss(config);
}
