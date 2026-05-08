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
