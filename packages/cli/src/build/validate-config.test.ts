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
    await expect(
      validateConfig({ ...minimal, units: 'source', color: 'hex', typographyCompanions: false, basePxFontSize: 10 })
    ).resolves.toBeUndefined();
    await expect(validateConfig({ ...minimal, units: { types: { spacing: 'px' } } })).resolves.toBeUndefined();
    await expect(validateConfig({ ...minimal, units: 'rem' as 'source' })).rejects.toThrow(/^Config error: units: unknown preset "rem"/);
    await expect(validateConfig({ ...minimal, color: 'cmyk' as 'rgb' })).rejects.toThrow(/Config error: color/);
    await expect(validateConfig({ ...minimal, basePxFontSize: 0 })).rejects.toThrow(/basePxFontSize/);
  });

  it('accepts an old dialect "canonical" and refuses "style-dictionary" with what to write instead', async () => {
    const old = (dialect: string) => ({ ...minimal, dialect }) as unknown as Config;
    await expect(validateConfig(old('canonical'))).resolves.toBeUndefined();
    await expect(validateConfig(old('style-dictionary'))).rejects.toThrow(/"units": "tokens-studio"/);
  });
});
