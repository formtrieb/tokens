import { describe, it, expect } from 'vitest';
import { walkTokens, matchGlob, findByType } from './token-tree.js';
import type { Token } from '../types.js';

describe('walkTokens', () => {
  it('flattens a nested token tree', () => {
    const tree = {
      colors: {
        brand: {
          primary: { $type: 'color', $value: '#fff' },
        },
      },
      spacing: {
        small: { $type: 'dimension', $value: '4px' },
      },
    };
    const tokens = walkTokens(tree);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].path).toEqual(['colors', 'brand', 'primary']);
    expect(tokens[0].$type).toBe('color');
    expect(tokens[1].path).toEqual(['spacing', 'small']);
  });

  it('treats a node as terminal only if it has $type', () => {
    const tree = {
      group: {
        $description: 'just metadata',
        nested: { $type: 'dimension', $value: '8px' },
      },
    };
    const tokens = walkTokens(tree);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].path).toEqual(['group', 'nested']);
  });
});

describe('matchGlob', () => {
  const tokens: Token[] = [
    { path: ['spacing', 'small'], value: '4px', raw: {} },
    { path: ['spacing', 'medium'], value: '8px', raw: {} },
    { path: ['spacing', 'large', 'nested'], value: '32px', raw: {} },
    { path: ['colors', 'brand'], value: '#fff', raw: {} },
  ];

  it('matches a single-level wildcard', () => {
    const result = matchGlob(tokens, 'spacing.*');
    expect(result.map(t => t.path.join('.'))).toEqual([
      'spacing.small',
      'spacing.medium',
      'spacing.large.nested',
    ]);
  });

  it('matches the root prefix exactly', () => {
    const result = matchGlob(tokens, 'colors.*');
    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(['colors', 'brand']);
  });

  it('returns empty for non-matching globs', () => {
    expect(matchGlob(tokens, 'foo.*')).toEqual([]);
  });
});

describe('findByType', () => {
  const tokens: Token[] = [
    { path: ['display1'], value: {}, $type: 'typography', raw: {} },
    { path: ['body'], value: {}, $type: 'typography', raw: {} },
    { path: ['colors', 'brand'], value: '#fff', $type: 'color', raw: {} },
  ];

  it('filters tokens by $type', () => {
    expect(findByType(tokens, 'typography')).toHaveLength(2);
    expect(findByType(tokens, 'color')).toHaveLength(1);
    expect(findByType(tokens, 'shadow')).toEqual([]);
  });
});
