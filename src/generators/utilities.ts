/**
 * Writes all utility CSS files (typography, spacing, layout) to disk.
 */

import { promises } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../types.js';
import { generateTypographyClasses } from './typography-classes.js';
import { generateSpacingClasses } from './spacing-classes.js';
import { generateLayoutClasses } from './layout-classes.js';

export async function generateAllUtilities(config: Config): Promise<void> {
	const utilitiesPath = `${config.paths.output}/utilities`;

	await promises.mkdir(utilitiesPath, { recursive: true });

	const files: Array<{ name: string; generate: () => string | Promise<string> }> = [
		{ name: 'typography.css', generate: () => generateTypographyClasses(config) },
		{ name: 'spacing.css', generate: () => generateSpacingClasses(config) },
		{ name: 'layout.css', generate: () => generateLayoutClasses(config) },
	];

	for (const { name, generate } of files) {
		const content = await generate();
		await promises.writeFile(join(utilitiesPath, name), content);
		console.log(`✓ Generated ${name}`);
	}
}
