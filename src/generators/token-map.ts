/**
 * Generate a JSON lookup map from Figma token paths to CSS variable names.
 *
 * The map's single job: bridge Figma/Tokens-Studio token paths to the
 * generated CSS variable names. LLMs translating Figma components into code
 * use this lookup when building style rules.
 *
 *   figmaToCSS: "zIndex/base" → "--ds-z-index-base"
 *
 * The Figma path preserves source-JSON casing (e.g. `zIndex` stays one
 * segment), while the CSS variable name applies kebab-case to each segment
 * — matching what Style Dictionary emits in the generated CSS files.
 *
 * Token meaning, values, and theme resolution are NOT this file's job —
 * those live in the Tokens MCP, which reads the source token JSON directly.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Config } from '../types.js';
import { toKebabCase } from '../shared/kebab.js';
import { isPathPrivate } from '../build/style-dictionary.js';

interface TokenMap {
	prefix: string;
	count: number;
	transform: string;
	categories: Record<string, number>;
	figmaToCSS: Record<string, string>;
}

interface ThemesJsonEntry {
	selectedTokenSets: Record<string, 'enabled' | 'source' | 'disabled'>;
}

/**
 * Properties that the typography post-processor synthesises into individual
 * CSS variables alongside each typography composite token.
 *
 * `sourceField` is the key on the typography `$value` object. `figmaSegment`
 * is what we append to the typography token's Figma path; we mirror the CSS
 * property name in camelCase so the segment kebab-cases identically to the
 * generated CSS variable suffix (see typography-expansion.ts).
 */
const TYPOGRAPHY_EXPANSIONS: ReadonlyArray<{
	sourceField: string;
	figmaSegment: string;
}> = [
	{ sourceField: 'letterSpacing', figmaSegment: 'letterSpacing' },
	{ sourceField: 'textCase', figmaSegment: 'textTransform' },
	{ sourceField: 'textDecoration', figmaSegment: 'textDecoration' },
	{ sourceField: 'paragraphIndent', figmaSegment: 'textIndent' },
	{ sourceField: 'paragraphSpacing', figmaSegment: 'marginBlockEnd' },
];

export async function generateTokenMap(config: Config): Promise<void> {
	const prefix = config.prefix;
	const tokenMapPath = config.paths.tokenMap;
	const tokensPath = config.paths.tokens;
	const privatePrefixes = config.privateTokenPrefixes ?? ['*'];

	const enabledSets = await collectEnabledSets(tokensPath);
	const figmaToCSS: Record<string, string> = {};

	for (const setName of enabledSets) {
		const setFile = join(tokensPath, `${setName}.json`);
		if (!existsSync(setFile)) continue;

		const data = JSON.parse(await readFile(setFile, 'utf-8')) as Record<
			string,
			unknown
		>;
		collectTokens(data, [], privatePrefixes, prefix, figmaToCSS);
	}

	const tokenMap: TokenMap = {
		prefix: `--${prefix}`,
		count: Object.keys(figmaToCSS).length,
		transform: `Each Figma path becomes a CSS variable: kebab-case each segment then join with '-' and prepend '--${prefix}'.`,
		categories: buildCategoriesIndex(figmaToCSS),
		figmaToCSS,
	};

	await mkdir(dirname(tokenMapPath), { recursive: true });
	await writeFile(tokenMapPath, JSON.stringify(tokenMap, null, 2), 'utf-8');

	console.log(
		`✅ Token map generated: ${tokenMap.count} tokens → token-map.json`,
	);
	console.log(`   Categories: ${Object.keys(tokenMap.categories).length}`);
}

/**
 * Reads $themes.json and returns the set of token-set names that are
 * `enabled` in at least one theme. `source` sets are skipped because their
 * tokens are pulled in for reference resolution but not emitted as CSS.
 */
async function collectEnabledSets(tokensPath: string): Promise<Set<string>> {
	const themesFile = join(tokensPath, '$themes.json');
	const themes = JSON.parse(
		await readFile(themesFile, 'utf-8'),
	) as ThemesJsonEntry[];

	const enabled = new Set<string>();
	for (const theme of themes) {
		for (const [setName, status] of Object.entries(theme.selectedTokenSets)) {
			if (status === 'enabled') enabled.add(setName);
		}
	}
	return enabled;
}

/**
 * Recursively walk a token tree, collecting every leaf into figmaToCSS.
 * Container nodes have no $type; leaves carry $type and $value.
 */
function collectTokens(
	node: unknown,
	path: string[],
	privatePrefixes: string[],
	prefix: string,
	out: Record<string, string>,
): void {
	if (node === null || typeof node !== 'object') return;
	const obj = node as Record<string, unknown>;

	if ('$type' in obj && '$value' in obj) {
		if (isPathPrivate(path, privatePrefixes)) return;

		const figmaPath = path.join('/');
		const cssVar = pathToCssVar(path, prefix);
		out[figmaPath] = cssVar;

		if (obj.$type === 'typography' && isTypographyValue(obj.$value)) {
			expandTypography(path, obj.$value, prefix, out);
		}
		return;
	}

	for (const [key, value] of Object.entries(obj)) {
		if (key.startsWith('$')) continue;
		collectTokens(value, [...path, key], privatePrefixes, prefix, out);
	}
}

function pathToCssVar(path: string[], prefix: string): string {
	return `--${prefix}${path.map((seg) => toKebabCase(seg)).join('-')}`;
}

function isTypographyValue(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function expandTypography(
	path: string[],
	value: Record<string, unknown>,
	prefix: string,
	out: Record<string, string>,
): void {
	for (const { sourceField, figmaSegment } of TYPOGRAPHY_EXPANSIONS) {
		if (!value[sourceField]) continue;
		const expandedPath = [...path, figmaSegment];
		out[expandedPath.join('/')] = pathToCssVar(expandedPath, prefix);
	}
}

/**
 * Top-of-file index so an LLM gets a quick orientation over what categories
 * of tokens exist, without scrolling through 1800+ entries.
 *
 * Adaptive depth: groups whose token count exceeds EXPAND_THRESHOLD are
 * expanded one level deeper, recursively, until each bucket is either small
 * enough or the path ends. Capped at MAX_DEPTH so the index can't run away.
 */
const EXPAND_THRESHOLD = 100;
const MAX_DEPTH = 4;

function buildCategoriesIndex(
	figmaToCSS: Record<string, string>,
): Record<string, number> {
	const counts: Record<string, number> = {};
	collectCategories(Object.keys(figmaToCSS), 1, counts);
	return counts;
}

function collectCategories(
	paths: string[],
	depth: number,
	out: Record<string, number>,
): void {
	const grouped: Record<string, string[]> = {};
	for (const path of paths) {
		const parts = path.split('/');
		const key = parts.slice(0, depth).join('/');
		(grouped[key] ??= []).push(path);
	}

	for (const [key, group] of Object.entries(grouped)) {
		const canExpand =
			group.length > EXPAND_THRESHOLD &&
			depth < MAX_DEPTH &&
			group.some((p) => p.split('/').length > depth);

		if (canExpand) {
			collectCategories(group, depth + 1, out);
		} else {
			out[key] = group.length;
		}
	}
}
