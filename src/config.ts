/**
 * Shared configuration for the token build pipeline.
 *
 * Paths are resolved relative to the design-system project root, not to this file,
 * so the pipeline keeps working if these tools are later extracted into a package.
 */

import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Project root (FormtriebTokenResolver/) */
const projectRoot = join(__dirname, '..');

/** Root path for all generated CSS output */
const cssRootPath = join(projectRoot, 'cssOutput', 'css');

export const config = {
	/** Prefix for all CSS custom properties */
	prefix: 'ds-',

	/** Path to the Figma-exported tokens directory*/
	tokensPath: join(projectRoot, 'tokens'),

	/** Path where the Figma↔CSS lookup map is written */
	tokenMapPath: join(projectRoot, 'cssOutput', 'tokens', 'token-map.json'),

	cssRootPath,

	/** Path where generated CSS variable files will be written */
	buildPath: join(cssRootPath, 'variables'),

	/** Path where utility CSS files will be written */
	utilitiesPath: join(cssRootPath, 'utilities'),

	/** Barrel import file that ties variables + utilities together */
	mainCssPath: join(cssRootPath, 'main.css'),

	/** Self-contained bundle (all @imports inlined) for external consumers */
	bundleCssPath: join(cssRootPath, 'bundle.css'),
} as const;
