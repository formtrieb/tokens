import { describe, it, expect } from 'vitest';
import { defineConfig } from './define-config.js';

describe('defineConfig', () => {
  it('returns the input config unchanged', () => {
    const cfg = defineConfig({
      prefix: 'ds-',
      paths: { tokens: './tokens', output: './out', tokenMap: './out/map.json' },
    });
    expect(cfg.prefix).toBe('ds-');
    expect(cfg.paths.tokens).toBe('./tokens');
  });
});
