import { describe, it, expect } from 'vitest';
import StyleDictionary from 'style-dictionary';
import { isPathPrivate, TRANSFORMS } from './style-dictionary.js';

describe('isPathPrivate', () => {
	it('respects the * default prefix', () => {
		expect(isPathPrivate(['colors', '*hidden'], ['*'])).toBe(true);
		expect(isPathPrivate(['colors', 'visible'], ['*'])).toBe(false);
	});

	it('respects multiple configured prefixes', () => {
		expect(isPathPrivate(['_internal', 'foo'], ['*', '_'])).toBe(true);
		expect(isPathPrivate(['public', 'foo'], ['*', '_'])).toBe(false);
	});

	it('checks every segment', () => {
		expect(isPathPrivate(['a', 'b', '*c', 'd'], ['*'])).toBe(true);
	});
});

/**
 * Style Dictionary concatenates a platform's `transformGroup` with its
 * `transforms` (lib/transform/config.js). The `tokens-studio` group already
 * contains most of what TRANSFORMS lists, so anything named in both runs twice.
 *
 * `ts/color/modifiers` is the one duplicate that is not idempotent: running it
 * twice applies `darken: 0.2` twice, which is how the shipped CSS came to carry
 * colours no token asks for.
 */
describe('effective transform list', () => {
	// Importing the module above ran register(), so the group exists.
	const effective = () => [
		...StyleDictionary.hooks.transformGroups['tokens-studio'],
		...TRANSFORMS,
	];

	it('applies ts/color/modifiers exactly once', () => {
		expect(effective().filter((t) => t === 'ts/color/modifiers')).toHaveLength(1);
	});

	it('introduces no duplicate beyond the known, accepted ones', () => {
		const ACCEPTED = [
			// Deliberate override: the group ends with name/camel, and only a
			// later platform-level name/kebab wins. Removing this renames every
			// CSS variable to camelCase.
			'name/kebab',
			// Idempotent; left in place so the group's ordering is not disturbed.
			'ts/resolveMath',
			'ts/opacity',
			'ts/size/lineheight',
			'ts/typography/fontWeight',
			'ts/size/css/letterspacing',
			'ts/color/css/hexrgba',
			'color/css',
			'fontFamily/css',
		];
		const list = effective();
		const duplicates = [...new Set(list.filter((t, i) => list.indexOf(t) !== i))];
		expect(duplicates.filter((d) => !ACCEPTED.includes(d))).toEqual([]);
	});
});
