import { describe, it, expect } from 'vitest';
import { validateConfig } from './validate-config.js';
import { typography } from '../builders/index.js';
import type { Config } from '../types.js';

const minimal: Config = {
  prefix: 'ds-',
  paths: { tokens: './tokens', output: './out', tokenMap: './out/map.json' },
};

describe('validateConfig', () => {
  it('passes for a minimal valid config', async () => {
    await expect(validateConfig(minimal)).resolves.toBeUndefined();
  });

  it('throws when prefix is missing', async () => {
    await expect(
      validateConfig({ ...minimal, prefix: '' as unknown as string })
    ).rejects.toThrow(/prefix/i);
  });

  it('throws when typography() is configured but tokens dir has no Typography group', async () => {
    const cfg: Config = {
      ...minimal,
      paths: { ...minimal.paths, tokens: '/nonexistent' },
      utilities: [typography()],
    };
    await expect(validateConfig(cfg)).rejects.toThrow();
  });
});
