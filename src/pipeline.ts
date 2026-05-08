import { processAllThemes } from './build/theme-processor.js';
import { generateAllUtilities } from './generators/utilities.js';
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

export async function runPipeline(_config: Config, options: RunOptions = {}): Promise<void> {
  const steps = options.only ?? ALL_STEPS;

  if (steps.includes('themes')) await processAllThemes();
  if (steps.includes('utilities')) await generateAllUtilities();
  if (steps.includes('imports')) generateCssImports();
  if (steps.includes('token-map')) await generateTokenMap();
  if (steps.includes('bundle')) bundleCss();
}
