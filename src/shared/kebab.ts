import { kebabCase } from 'change-case';

/**
 * Converts a string or path array to kebab-case using the same `change-case`
 * library Style Dictionary uses for its `nameKebab` transform — keeping the
 * generated CSS variable names in lockstep with SD's output.
 *
 * Examples:
 *   "Display 1"    → "display-1"
 *   "textCase"     → "text-case"
 *   "0_25x"        → "0-25x"   (underscore separator)
 *   ["Label","Lg"] → "label-lg"
 */
export function toKebabCase(input: string | string[]): string {
	const str = Array.isArray(input) ? input.join('-') : input;
	return kebabCase(str);
}
