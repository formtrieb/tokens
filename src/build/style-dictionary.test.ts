import { describe, it, expect } from 'vitest';
import { isPathPrivate } from './style-dictionary.js';

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
