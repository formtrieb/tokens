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
  const allowed = { dialect: ['style-dictionary', 'canonical'], units: ['rem', 'source'], color: ['rgb', 'source'] } as const;
  for (const [key, values] of Object.entries(allowed) as [keyof typeof allowed, readonly string[]][]) {
    if (config[key] !== undefined && !values.includes(config[key]!)) {
      throw new Error(`Config error: ${key} must be one of ${values.map((v) => `'${v}'`).join(', ')}.`);
    }
  }
  if (config.basePxFontSize !== undefined && !(typeof config.basePxFontSize === 'number' && config.basePxFontSize > 0)) {
    throw new Error('Config error: basePxFontSize must be a positive number.');
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
