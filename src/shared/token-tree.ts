import type { Token } from '../types.js';

export function walkTokens(
  node: Record<string, unknown>,
  path: string[] = []
): Token[] {
  const tokens: Token[] = [];
  for (const [key, raw] of Object.entries(node)) {
    if (key.startsWith('$')) continue; // metadata fields
    if (typeof raw !== 'object' || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.$type === 'string' && '$value' in obj) {
      tokens.push({
        path: [...path, key],
        value: obj.$value,
        $type: obj.$type as string,
        raw: obj,
      });
    } else {
      tokens.push(...walkTokens(obj, [...path, key]));
    }
  }
  return tokens;
}

// stubs for next tasks
export function matchGlob(_tokens: Token[], _glob: string): Token[] {
  throw new Error('not implemented');
}
export function findByType(_tokens: Token[], _type: string): Token[] {
  throw new Error('not implemented');
}
