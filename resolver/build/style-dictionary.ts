/**
 * Style Dictionary setup: transforms, filters, and per-theme build config.
 *
 * Centralises the tokens-studio integration so the rest of the pipeline
 * doesn't need to know about SD internals.
 */

import { register, type TransformOptions } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';
import { outputReferencesTransformed } from 'style-dictionary/utils';
import { transforms } from 'style-dictionary/enums';
import type { TransformedToken, Dictionary } from 'style-dictionary/types';
import { config } from '../config.js';
import type { Theme } from '../shared/types.js';

const { prefix, tokensPath, buildPath } = config;

const TRANSFORMS = [
	'ts/resolveMath',
	'ts/color/modifiers',
	'ts/opacity',
	'ts/size/lineheight',
	'ts/typography/fontWeight',
	'ts/size/css/letterspacing',
	'ts/color/css/hexrgba',
	transforms.colorCss,
	transforms.colorRgb,
	transforms.sizePxToRem,
	transforms.nameKebab,
	transforms.fontFamilyCss,
];

const TRANSFORM_OPTIONS: TransformOptions = {
	platform: 'css',
	name: 'tokens-studio',
	excludeParentKeys: false,
	alwaysAddFontStyle: false,
	['ts/color/modifiers']: {
		format: 'srgb',
	},
};

/**
 * Source filter: include tokens originating from "enabled" sets, but skip
 * private tokens (path segments starting with "*").
 */
StyleDictionary.registerFilter({
	name: 'isSource',
	filter: (token) => {
		if (!token.isSource) return false;
		return !token.path.some((segment: string) => segment.startsWith('*'));
	},
});

register(StyleDictionary, TRANSFORM_OPTIONS);

/**
 * Builds CSS for a single theme into a temp file under buildPath.
 *
 * @param theme              Theme definition from `$themes.json`
 * @param tempFile           Output filename (relative to buildPath)
 * @param outputReferences   If true, emit `var(--...)` references instead of
 *                           raw resolved values. Only applied to tokens that
 *                           don't carry color modifiers (those need the
 *                           transformed form to preserve the modifier output).
 */
export async function buildTheme(
	theme: Theme,
	tempFile: string,
	outputReferences = false
): Promise<void> {
	const sdConfig = {
		log: {
			warnings: 'warn' as const,
			verbosity: 'verbose' as const,
			errors: {
				brokenReferences: 'console' as const,
			},
		},
		source: Object.entries(theme.selectedTokenSets)
			.filter(([, val]) => val === 'enabled')
			.map(([tokenset]) => `${tokensPath}/${tokenset}.json`),
		include: Object.entries(theme.selectedTokenSets)
			.filter(([, val]) => val === 'source')
			.map(([tokenset]) => `${tokensPath}/${tokenset}.json`),
		preprocessors: ['tokens-studio'],
		platforms: {
			css: {
				prefix,
				transformGroup: 'tokens-studio',
				transforms: TRANSFORMS,
				buildPath: `${buildPath}/`,
				files: [
					{
						destination: tempFile,
						format: 'css/variables',
						filter: 'isSource',
						options: {
							outputReferences: outputReferences
								? (token: TransformedToken, options: { dictionary: Dictionary; usesDtcg?: boolean }) => {
										if (token.$extensions?.['studio.tokens']?.modify) {
											return outputReferencesTransformed(token, options);
										}
										return true;
								  }
								: false,
						},
					},
				],
			},
		},
	};

	const sd = new StyleDictionary(sdConfig);
	await sd.buildAllPlatforms();
}
