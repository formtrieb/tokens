/**
 * Writes all utility CSS files (typography, spacing, layout) to disk.
 */

import { promises } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { generateTypographyClasses } from './typography-classes.js';
import { generateSpacingClasses } from './spacing-classes.js';
import { generateLayoutClasses } from './layout-classes.js';

const { utilitiesPath } = config;

export async function generateAllUtilities(): Promise<void> {
	await promises.mkdir(utilitiesPath, { recursive: true });

	const files: Array<{ name: string; generate: () => string | Promise<string> }> = [
		{ name: 'typography.css', generate: generateTypographyClasses },
		{ name: 'spacing.css', generate: generateSpacingClasses },
		{ name: 'layout.css', generate: generateLayoutClasses },
	];

	for (const { name, generate } of files) {
		const content = await generate();
		await promises.writeFile(join(utilitiesPath, name), content);
		console.log(`✓ Generated ${name}`);
	}
}
