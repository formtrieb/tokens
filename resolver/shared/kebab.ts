/**
 * Converts a string or path array to kebab-case.
 *
 * Examples:
 *   "Display 1"    → "display-1"
 *   "textCase"     → "text-case"
 *   ["Label","Lg"] → "label-lg"
 */
export function toKebabCase(input: string | string[]): string {
	const str = Array.isArray(input) ? input.join('-') : input;
	return str
		.replace(/\s+/g, '-')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.toLowerCase();
}
