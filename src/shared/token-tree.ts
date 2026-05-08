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

export function matchGlob(tokens: Token[], glob: string): Token[] {
  const segments = glob.split('.');
  const wildcardIdx = segments.indexOf('*');
  if (wildcardIdx === -1) {
    // exact match
    return tokens.filter(t => t.path.join('.') === glob);
  }
  const prefix = segments.slice(0, wildcardIdx);
  return tokens.filter(t => {
    if (t.path.length <= prefix.length) return false;
    return prefix.every((seg, i) => t.path[i] === seg);
  });
}
export function findByType(tokens: Token[], type: string): Token[] {
  return tokens.filter(t => t.$type === type);
}
