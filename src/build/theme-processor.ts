/**
 * Theme group processing.
 *
 * Reads `$themes.json`, groups themes by their `group` property, and writes
 * one CSS file per group:
 *
 *   - Group with a single theme   → `:root { … }`                    (e.g. Foundation, Typography)
 *   - Group with multiple themes  → `[data-{group}="{name}"] { … }` (e.g. Mode: light/dark)
 *
 * Two groups get special treatment:
 *   - `Foundation` is emitted with raw values (no CSS-var references).
 *   - `Typography` gets post-processed via {@link expandTypographyInFile}.
 */

import { promises } from 'node:fs';
import { config } from '../config.js';
import type { GroupedThemes, Theme } from '../shared/types.js';
import { toKebabCase } from '../shared/kebab.js';
import { buildTheme } from './style-dictionary.js';
import { expandTypographyInFile } from './typography-expansion.js';

const { tokensPath, buildPath } = config;

const GROUP_NAMES = {
	FOUNDATION: 'Foundation',
	TYPOGRAPHY: 'Typography',
} as const;

const FILE_HEADER = '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';

function groupThemesByGroup(themes: Theme[]): GroupedThemes {
	return themes.reduce((acc, theme) => {
		if (!acc[theme.group]) acc[theme.group] = [];
		acc[theme.group].push(theme);
		return acc;
	}, {} as GroupedThemes);
}

/**
 * Single-theme group → emit CSS with `:root` selector.
 */
async function processSingleThemeGroup(groupName: string, theme: Theme): Promise<void> {
	const outputFile = `${toKebabCase(groupName)}.css`;
	const tempFile = `_temp_${theme.name}.css`;

	const useReferences = groupName !== GROUP_NAMES.FOUNDATION;

	await buildTheme(theme, tempFile, useReferences);

	const content = await promises.readFile(`${buildPath}/${tempFile}`, 'utf-8');
	await promises.writeFile(`${buildPath}/${outputFile}`, content);
	await promises.unlink(`${buildPath}/${tempFile}`);

	if (groupName === GROUP_NAMES.TYPOGRAPHY) {
		await expandTypographyInFile(`${buildPath}/${outputFile}`);
	}

	const referenceNote = useReferences ? ' (with references)' : ' (raw values)';
	console.log(`✓ Built ${outputFile}${referenceNote}`);
}

/**
 * Multi-theme group → emit one CSS file with `[data-{group}="{name}"]`
 * selectors for each variant.
 */
async function processMultiThemeGroup(groupName: string, themes: Theme[]): Promise<void> {
	const baseName = toKebabCase(groupName);
	const outputFile = `${baseName}.css`;
	const dataAttribute = baseName;

	let combinedOutput = FILE_HEADER;

	for (const theme of themes) {
		const tempFile = `_temp_${theme.name}.css`;

		await buildTheme(theme, tempFile, true);

		let tempContent = await promises.readFile(`${buildPath}/${tempFile}`, 'utf-8');

		// Strip the per-file auto-generated header (we already wrote one above)
		// and retarget the :root selector to a data attribute.
		tempContent = tempContent.replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '');
		tempContent = tempContent.replace(':root', `[data-${dataAttribute}="${theme.name}"]`);

		combinedOutput += tempContent;

		await promises.unlink(`${buildPath}/${tempFile}`);
	}

	await promises.writeFile(`${buildPath}/${outputFile}`, combinedOutput.trim() + '\n');
	console.log(`✓ Built ${outputFile} (${themes.length} variants with references)`);
}

export async function processAllThemes(): Promise<void> {
	const themesData = JSON.parse(
		await promises.readFile(`${tokensPath}/$themes.json`, 'utf-8')
	);
	const themes: Theme[] = themesData;

	const grouped = groupThemesByGroup(themes);

	for (const [groupName, groupThemes] of Object.entries(grouped)) {
		if (groupThemes.length === 1) {
			await processSingleThemeGroup(groupName, groupThemes[0]);
		} else {
			await processMultiThemeGroup(groupName, groupThemes);
		}
	}
}
