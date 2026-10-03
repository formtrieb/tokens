import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

  const usesTypography = config.utilities?.some(
    (b) => b.builderName === 'typography'
  );

  if (usesTypography) {
    const themesPath = join(config.paths.tokens, '$themes.json');
    let themes: unknown;
    try {
      themes = JSON.parse(await readFile(themesPath, 'utf-8'));
    } catch (err) {
      throw new Error(
        `Config error: cannot read $themes.json at ${themesPath}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    const hasTypographyGroup =
      Array.isArray(themes) &&
      (themes as Array<{ group?: string }>).some((t) => t.group === 'Typography');
    if (!hasTypographyGroup) {
      throw new Error(
        'Config error: typography() builder requires a "Typography" theme group in $themes.json.'
      );
    }
  }
}
