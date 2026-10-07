import { parseRenderFile } from '@formtrieb/tokens-render';
import type { Config } from '../types.js';

export async function validateConfig(config: Config): Promise<void> {
  if (!config.prefix) {
    throw new Error('Config error: prefix must be a non-empty string.');
  }
  if (!config.paths?.tokens || !config.paths?.output || !config.paths?.tokenMap) {
    throw new Error(
      'Config error: paths.tokens, paths.output, paths.tokenMap are required.'
    );
  }
  // The output options are checked as a render file checks them; an old `dialect` too.
  const options: Record<string, unknown> = {};
  for (const key of ['units', 'color', 'basePxFontSize', 'typographyCompanions', 'dialect'] as const) {
    const value = (config as unknown as Record<string, unknown>)[key];
    if (value !== undefined) options[key] = value;
  }
  try {
    parseRenderFile({ options, rules: [] }, 'config');
  } catch (e) {
    throw new Error(`Config error: ${(e as Error).message.replace(/^config: options\./, '')}`);
  }
  if (config.render !== undefined && typeof config.render !== 'string') {
    if (!Array.isArray(config.render)) {
      throw new Error('Config error: render must be a list of rules or a path to a JSON file of rules.');
    }
    config.render.forEach((rule, i) => {
      for (const key of ['theme', 'selector', 'file'] as const) {
        if (typeof rule?.[key] !== 'string' || !rule[key]) {
          throw new Error(`Config error: render[${i}].${key} must be a non-empty string.`);
        }
      }
      if (typeof rule.references !== 'boolean') {
        throw new Error(`Config error: render[${i}].references must be true or false.`);
      }
    });
  }
}
