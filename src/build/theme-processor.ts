/**
 * Theme group processing.
 *
 * Reads `$themes.json`, groups themes by their `group` property, and writes
 * one CSS file per group:
 *
 *   - Group with a single theme   → `:root { … }`                    (e.g. Foundation, Typography)
 *   - Group with multiple themes  → `[data-{group}="{name}"] { … }` (e.g. Mode: light/dark)
 *
 * Reference behaviour per group is driven by `config.themeGroups` (with a fall
 * back to `config.defaultGroupBehavior`). The `Typography` group additionally
 * gets post-processed via {@link expandTypographyInFile}.
 */

import { promises } from 'node:fs';
import type { GroupedThemes, Theme } from '../shared/types.js';
import type { Config, ThemeGroupBehavior } from '../types.js';
import { toKebabCase } from '../shared/kebab.js';
import { buildTheme } from './style-dictionary.js';
import { expandTypographyInFile } from './typography-expansion.js';

const GROUP_NAMES = {
	TYPOGRAPHY: 'Typography',
} as const;

const FILE_HEADER = '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';

function getGroupBehavior(groupName: string, config: Config): ThemeGroupBehavior {
	return (
		config.themeGroups?.[groupName] ??
		config.defaultGroupBehavior ?? { useReferences: true }
	);
}

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
async function processSingleThemeGroup(
	groupName: string,
	theme: Theme,
	config: Config
): Promise<void> {
	const buildPath = `${config.paths.output}/variables`;
	const outputFile = `${toKebabCase(groupName)}.css`;
	const tempFile = `_temp_${theme.name}.css`;

	const useReferences = getGroupBehavior(groupName, config).useReferences;

	await buildTheme(theme, tempFile, useReferences, config);

	const content = await promises.readFile(`${buildPath}/${tempFile}`, 'utf-8');
	await promises.writeFile(`${buildPath}/${outputFile}`, content);
	await promises.unlink(`${buildPath}/${tempFile}`);

	if (groupName === GROUP_NAMES.TYPOGRAPHY) {
		await expandTypographyInFile(`${buildPath}/${outputFile}`, config);
	}

	const referenceNote = useReferences ? ' (with references)' : ' (raw values)';
	console.log(`✓ Built ${outputFile}${referenceNote}`);
}

/**
 * Multi-theme group → emit one CSS file with `[data-{group}="{name}"]`
 * selectors for each variant.
 */
async function processMultiThemeGroup(
	groupName: string,
	themes: Theme[],
	config: Config
): Promise<void> {
	const buildPath = `${config.paths.output}/variables`;
	const baseName = toKebabCase(groupName);
	const outputFile = `${baseName}.css`;
	const dataAttribute = baseName;

	const useReferences = getGroupBehavior(groupName, config).useReferences;

	let combinedOutput = FILE_HEADER;

	for (const theme of themes) {
		const tempFile = `_temp_${theme.name}.css`;

		await buildTheme(theme, tempFile, useReferences, config);

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

export async function processAllThemes(config: Config): Promise<void> {
	const tokensPath = config.paths.tokens;

	const themesData = JSON.parse(
		await promises.readFile(`${tokensPath}/$themes.json`, 'utf-8')
	);
	const themes: Theme[] = themesData;

	const grouped = groupThemesByGroup(themes);

	for (const [groupName, groupThemes] of Object.entries(grouped)) {
		if (groupThemes.length === 1) {
			await processSingleThemeGroup(groupName, groupThemes[0], config);
		} else {
			await processMultiThemeGroup(groupName, groupThemes, config);
		}
	}
}
