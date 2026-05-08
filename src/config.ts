import { join } from 'node:path';
import baseConfig from '../formtrieb-tokens.config.js';

const cssRootPath = baseConfig.paths.output;

/**
 * Legacy config shape used by existing build/generator code.
 * Derives all paths from the dogfood config so there is a single source of truth.
 * This shim is removed in Phase 4 once all pipeline functions take Config directly.
 */
export const config = {
  prefix: baseConfig.prefix,
  tokensPath: baseConfig.paths.tokens,
  tokenMapPath: baseConfig.paths.tokenMap,
  cssRootPath,
  buildPath: join(cssRootPath, 'variables'),
  utilitiesPath: join(cssRootPath, 'utilities'),
  mainCssPath: join(cssRootPath, 'main.css'),
  bundleCssPath: join(cssRootPath, 'bundle.css'),
} as const;
