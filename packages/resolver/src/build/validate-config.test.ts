import { describe, it, expect } from 'vitest';
import { validateConfig } from './validate-config.js';
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

  it('accepts a render table and names the broken rule', async () => {
    const rule = { theme: 'Mode/Dark', selector: '.dark', references: true, file: 'variables/mode.css' };
    await expect(validateConfig({ ...minimal, render: [rule] })).resolves.toBeUndefined();
    await expect(validateConfig({ ...minimal, render: 'render.json' })).resolves.toBeUndefined();
    await expect(
      validateConfig({ ...minimal, render: [rule, { ...rule, selector: '' }] })
    ).rejects.toThrow(/render\[1\]\.selector/);
  });

  it('names an output option with an unknown value', async () => {
    await expect(validateConfig({ ...minimal, dialect: 'canonical', units: 'source', basePxFontSize: 10 })).resolves.toBeUndefined();
    await expect(validateConfig({ ...minimal, dialect: 'swift' as 'canonical' })).rejects.toThrow(/dialect must be one of/);
    await expect(validateConfig({ ...minimal, basePxFontSize: 0 })).rejects.toThrow(/basePxFontSize/);
  });
});
