/**
 * Walk a tokens-studio token tree and collect every typography composite token.
 *
 * A typography token is identified by `$type === 'typography'`. Any other
 * terminal token (has `$type`) is ignored — we only recurse through container
 * nodes that have no `$type` of their own.
 */

import { promises } from 'node:fs';
import type { TypographyToken } from './types.js';

export function findTypographyTokens(
	obj: Record<string, Record<string, unknown>>,
	path: string[] = []
): TypographyToken[] {
	const tokens: TypographyToken[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value !== 'object' || value === null) continue;

		if (value['$type'] === 'typography' && value['$value']) {
			tokens.push({
				path: [...path, key],
				value: value['$value'] as TypographyToken['value'],
			});
		} else if (!value['$type']) {
			tokens.push(
				...findTypographyTokens(value as Record<string, Record<string, unknown>>, [...path, key])
			);
		}
	}

	return tokens;
}

/**
 * Loads the Typography token file and returns all typography composite tokens.
 */
export async function loadTypographyTokens(tokensPath: string): Promise<TypographyToken[]> {
	const data = JSON.parse(
		await promises.readFile(`${tokensPath}/Typography/Typography.json`, 'utf-8')
	);
	return findTypographyTokens(data);
}
