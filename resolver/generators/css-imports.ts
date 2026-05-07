/**
 * Regenerates the `main.css` barrel file.
 *
 * Preserves any manually-added lines (e.g. `@import './fonts.css'`,
 * `@import './reset.css'`, `@import './_typography.scss'`) and only rewrites
 * the auto-generated blocks that import variables/* and utilities/*.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { config } from '../config.js';

const { cssRootPath, buildPath, utilitiesPath, mainCssPath } = config;

export function generateCssImports(): void {
	// 1. Read existing file and strip the auto-generated block
	let existingLines: string[] = [];
	try {
		existingLines = readFileSync(mainCssPath, 'utf-8').split('\n');
	} catch {
		// file doesn't exist yet — start fresh
	}

	const manualLines = existingLines.filter((line) => {
		const trimmed = line.trim();
		if (trimmed.startsWith('/* Auto-generated')) return false;
		if (trimmed.startsWith('/* Utility')) return false;
		if (trimmed.startsWith('@import') && trimmed.includes('./variables/')) return false;
		if (trimmed.startsWith('@import') && trimmed.includes('./utilities/')) return false;
		return true;
	});

	const trimmedManual = manualLines.join('\n').trimEnd();

	// 2. Generate fresh variable imports
	const cssFiles = readdirSync(buildPath)
		.filter((file) => file.endsWith('.css'))
		.sort();

	const variableBlock = [
		'/* Auto-generated — do not edit manually. Run: npm run generate:css */',
		...cssFiles.map((file) => `@import './${relative(cssRootPath, join(buildPath, file))}';`),
	].join('\n');

	// 3. Generate utility imports
	let utilityBlock = '';
	if (existsSync(utilitiesPath)) {
		const utilFiles = readdirSync(utilitiesPath)
			.filter((file) => file.endsWith('.css'))
			.sort();

		if (utilFiles.length > 0) {
			utilityBlock = '\n' + [
				'/* Utility classes — auto-generated */',
				...utilFiles.map((file) => `@import './${relative(cssRootPath, join(utilitiesPath, file))}';`),
			].join('\n');
		}
	}

	// 4. Write: manual content first, then generated blocks
	const generatedBlock = variableBlock + utilityBlock;
	const output = trimmedManual
		? `${trimmedManual}\n${generatedBlock}\n`
		: `${generatedBlock}\n`;

	mkdirSync(dirname(mainCssPath), { recursive: true });
	writeFileSync(mainCssPath, output, 'utf-8');
	console.log(`main.css updated with ${cssFiles.length} variable imports + utilities (manual imports preserved)`);
}
