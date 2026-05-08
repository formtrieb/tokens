/**
 * Typography post-processing for generated CSS files.
 *
 * Two fixes happen here:
 *
 * 1. Font shorthand order fix — `sd-transforms` can emit the font shorthand
 *    with operands swapped (line-heights before the "/" and font-sizes after),
 *    depending on JSON key order in the source tokens. We normalise it to
 *    `font-size/line-height`.
 *
 * 2. Typography property expansion — CSS `font` shorthand cannot carry
 *    `letter-spacing`, `text-transform` or `text-decoration`. We add
 *    individual CSS custom properties for those so the utility classes can
 *    apply them alongside the shorthand.
 */

import { promises } from 'node:fs';
import type { Config } from '../types.js';
import { toKebabCase } from '../shared/kebab.js';
import { loadTypographyTokens } from '../shared/typography-tokens.js';

/**
 * Converts a `{textCase.uppercase}` style reference to `--ds-text-case-uppercase`.
 */
function tokenReferenceToCssVar(refString: string, prefix: string): string {
	const match = refString.match(/^\{(.+)\}$/);
	if (!match) return '';

	const reference = match[1].replace(/\./g, '-');
	return `--${prefix}${toKebabCase(reference)}`;
}

function fixFontShorthandOrder(content: string, prefix: string): string {
	const escapedPrefix = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
	const fontOrderFix = new RegExp(
		`var\\(--${escapedPrefix}line-heights-([^)]+)\\)\\/var\\(--${escapedPrefix}font-sizes-([^)]+)\\)`,
		'g'
	);
	return content.replace(fontOrderFix, `var(--${prefix}font-sizes-$2)/var(--${prefix}line-heights-$1)`);
}

export async function expandTypographyInFile(filePath: string, config: Config): Promise<void> {
	const prefix = config.prefix;
	const tokensPath = config.paths.tokens;

	let content = await promises.readFile(filePath, 'utf-8');

	content = fixFontShorthandOrder(content, prefix);

	const tokens = await loadTypographyTokens(tokensPath);

	const additions: string[] = [];

	for (const token of tokens) {
		const tokenName = toKebabCase(token.path);
		const fullName = `--${prefix}${tokenName}`;

		const properties: Array<{ suffix: string; value: string | undefined }> = [
			{ suffix: 'letter-spacing', value: token.value.letterSpacing },
			{ suffix: 'text-case', value: token.value.textCase },
			{ suffix: 'text-decoration', value: token.value.textDecoration },
		];

		for (const { suffix, value } of properties) {
			if (!value) continue;
			const cssVar = tokenReferenceToCssVar(value, prefix);
			if (cssVar) {
				additions.push(`  ${fullName}-${suffix}: var(${cssVar});`);
			}
		}
	}

	if (additions.length > 0) {
		content = content.replace(/(\n})\s*$/, `\n${additions.join('\n')}\n$1`);
		await promises.writeFile(filePath, content);
	}
}
