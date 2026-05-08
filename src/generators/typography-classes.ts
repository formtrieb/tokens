/**
 * Typography utility class generator.
 *
 * Emits one class per typography token, applying the `font` shorthand plus
 * the three properties that the shorthand can't carry (letter-spacing,
 * text-transform, text-decoration) via dedicated CSS variables.
 */

import type { Config } from '../types.js';
import { toKebabCase } from '../shared/kebab.js';
import { loadTypographyTokens } from '../shared/typography-tokens.js';

export async function generateTypographyClasses(config: Config): Promise<string> {
	const prefix = config.prefix;
	const tokensPath = config.paths.tokens;

	const header = `/**
 * Typography utility classes — auto-generated.
 * Apply full typography (font shorthand + letter-spacing + text-transform + text-decoration).
 *
 * Usage: <h1 class="${prefix}display-1">…</h1>
 *        <p class="${prefix}body-base-default">…</p>
 *        <span class="${prefix}label-small-default">…</span>
 */\n\n`;

	const tokens = await loadTypographyTokens(tokensPath);

	const rules = tokens.map((token) => {
		const className = toKebabCase(token.path);
		const varName = `--${prefix}${className}`;

		return `.${prefix}${className} {
  font: var(${varName});
  letter-spacing: var(${varName}-letter-spacing);
  text-transform: var(${varName}-text-case);
  text-decoration: var(${varName}-text-decoration);
}`;
	});

	return header + rules.join('\n\n') + '\n';
}
