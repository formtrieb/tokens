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
import type { TransformedToken, Dictionary, ValueTransform } from 'style-dictionary/types';
import type { Theme } from '../shared/types.js';
import type { Config } from '../types.js';

/**
 * Platform-level transforms, appended by Style Dictionary to whatever the
 * `tokens-studio` transformGroup already provides. Only list transforms the
 * group does NOT provide, or ones that must deliberately run after it —
 * `name/kebab` overrides the group's trailing `name/camel`.
 *
 * Never list `ts/color/modifiers` here: the group supplies it, already
 * configured with `format: 'srgb'` from TRANSFORM_OPTIONS, and a second entry
 * would apply every darken/lighten twice.
 */
export const PX_TO_REM = 'formtrieb/size/pxToRem';

export const TRANSFORMS = [
	'ts/resolveMath',
	'ts/opacity',
	'ts/size/lineheight',
	'ts/typography/fontWeight',
	'ts/size/css/letterspacing',
	'ts/color/css/hexrgba',
	transforms.colorCss,
	transforms.colorRgb,
	PX_TO_REM,
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
 * Tests whether a token path contains any segment with one of the configured
 * private prefixes. Used by the isSource filter to exclude private tokens.
 */
export function isPathPrivate(path: string[], prefixes: string[]): boolean {
	return path.some((segment) => prefixes.some((p) => segment.startsWith(p)));
}

/**
 * Module-scoped active config for the isSource filter. Set by buildTheme on
 * entry and cleared on exit. Style-Dictionary's filter API is a global
 * registry that doesn't accept context, so we thread config through here.
 */
let currentConfig: Config | undefined;

/**
 * Source filter: include tokens originating from "enabled" sets, but skip
 * private tokens whose path segments start with any configured prefix
 * (default ['*']).
 */
StyleDictionary.registerFilter({
	name: 'isSource',
	filter: (token) => {
		if (!token.isSource) return false;
		const prefixes = currentConfig?.privateTokenPrefixes ?? ['*'];
		return !isPathPrivate(token.path as string[], prefixes);
	},
});

register(StyleDictionary, TRANSFORM_OPTIONS);

/**
 * `size/pxToRem`, but only for values that are px or unitless. Style
 * Dictionary's own transform reads the number of every `dimension` as px, and
 * sd-transforms retypes `letterSpacing` as `dimension` after turning `-5%`
 * into `-0.05em` — so letter-spacing shipped as `-0.003125rem`. A value that
 * already carries another unit is left as it is.
 */
const PX_OR_UNITLESS = /^-?(\d+\.?\d*|\.\d+)(px)?$/;
const sizePxToRem = StyleDictionary.hooks.transforms[transforms.sizePxToRem] as ValueTransform;
StyleDictionary.registerTransform({
	name: PX_TO_REM,
	type: 'value',
	transform: sizePxToRem.transform,
	filter: (token, options) => {
		if (!sizePxToRem.filter?.(token, options)) return false;
		const value = options.usesDtcg ? token.$value : token.value;
		return typeof value === 'number' || PX_OR_UNITLESS.test(String(value).trim());
	},
});

/**
 * Builds CSS for a single theme into a temp file under buildPath.
 *
 * @param theme              Theme definition from `$themes.json`
 * @param tempFile           Output filename (relative to buildPath)
 * @param outputReferences   If true, emit `var(--...)` references instead of
 *                           raw resolved values. Only applied to tokens that
 *                           don't carry color modifiers (those need the
 *                           transformed form to preserve the modifier output).
 * @param config             Resolved pipeline config (provides prefix and paths).
 */
export async function buildTheme(
	theme: Theme,
	tempFile: string,
	outputReferences: boolean,
	config: Config
): Promise<void> {
	currentConfig = config;
	try {
		const prefix = config.prefix;
		const tokensPath = config.paths.tokens;
		const buildPath = `${config.paths.output}/variables`;

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
	} finally {
		currentConfig = undefined;
	}
}
