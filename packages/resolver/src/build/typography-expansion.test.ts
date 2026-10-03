import { describe, it, expect } from 'vitest';
import { buildExpansionAdditions } from './typography-expansion.js';
import type { Config } from '../types.js';
import type { TypographyToken } from '../shared/types.js';

const baseCfg: Config = {
  prefix: 'ds-',
  paths: { tokens: '', output: '', tokenMap: '' },
};

const monoToken: TypographyToken = {
  path: ['Mono', 'Base', 'default'],
  value: {
    fontFamily: '{fontFamilies.mono}',
    letterSpacing: '{letterSpacings.default}',
    textCase: '{textCase.default}',
    textDecoration: '{textDecorations.default}',
    paragraphIndent: '{paragraphIndents.none}',
    paragraphSpacing: '{paragraphSpacings.none}',
  },
};

const displayToken: TypographyToken = {
  path: ['Display', 'Display 1'],
  value: {
    fontFamily: '{fontFamilies.titleFamily}',
    letterSpacing: '{letterSpacings.tight3}',
    textCase: '{textCase.default}',
    textDecoration: '{textDecorations.default}',
    paragraphIndent: '{paragraphIndents.none}',
    paragraphSpacing: '{paragraphSpacings.none}',
  },
};

const tableNumericToken: TypographyToken = {
  path: ['Table', 'Numeric', 'Base', 'default'],
  value: {
    fontFamily: '{fontFamilies.baseFamily}',
    letterSpacing: '{letterSpacings.default}',
    textCase: '{textCase.default}',
    textDecoration: '{textDecorations.default}',
    paragraphIndent: '{paragraphIndents.none}',
    paragraphSpacing: '{paragraphSpacings.none}',
  },
};

const tableHeaderToken: TypographyToken = {
  path: ['Table', 'Header', 'Base', 'default'],
  value: {
    fontFamily: '{fontFamilies.baseFamily}',
    letterSpacing: '{letterSpacings.default}',
    textCase: '{textCase.default}',
    textDecoration: '{textDecorations.default}',
    paragraphIndent: '{paragraphIndents.none}',
    paragraphSpacing: '{paragraphSpacings.none}',
  },
};

describe('buildExpansionAdditions', () => {
  it('emits letter-spacing/text-transform/text-decoration vars per token', () => {
    const additions = buildExpansionAdditions([monoToken], baseCfg);
    expect(additions).toContain('  --ds-mono-base-default-letter-spacing: var(--ds-letter-spacings-default);');
    expect(additions).toContain('  --ds-mono-base-default-text-transform: var(--ds-text-case-default);');
    expect(additions).toContain('  --ds-mono-base-default-text-decoration: var(--ds-text-decorations-default);');
  });

  it('does NOT emit a -fvn var when typography config is absent', () => {
    const additions = buildExpansionAdditions([monoToken], baseCfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });

  it('does NOT emit a -fvn var when tabular list is empty', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });

  it('emits -fvn: tabular-nums for tokens whose top path segment matches', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['mono'], ['metric']] } },
    };
    const additions = buildExpansionAdditions([monoToken, displayToken], cfg);
    expect(additions).toContain('  --ds-mono-base-default-fvn: tabular-nums;');
    expect(additions.some((l) => l.startsWith('  --ds-display-display-1-fvn:'))).toBe(false);
  });

  it('matches case-insensitively (config "Mono" matches path "Mono")', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['Mono']] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions).toContain('  --ds-mono-base-default-fvn: tabular-nums;');
  });

  it('matches case-insensitively (config "mono" matches path "Mono")', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['mono']] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions).toContain('  --ds-mono-base-default-fvn: tabular-nums;');
  });

  it('does NOT match when only a deeper segment matches the config string', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['base']] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });

  it('matches a deeper-path prefix (config [["table","numeric"]] matches Table.Numeric.Base)', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['table', 'numeric']] } },
    };
    const additions = buildExpansionAdditions([tableNumericToken], cfg);
    expect(additions).toContain('  --ds-table-numeric-base-default-fvn: tabular-nums;');
  });

  it('does NOT match siblings (Table.Header is not matched by [["table","numeric"]])', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['table', 'numeric']] } },
    };
    const additions = buildExpansionAdditions([tableHeaderToken], cfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });

  it('empty inner array does NOT match anything (defensive)', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [[]] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });

  it('matches when prefix length equals token path length (exact match)', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['table', 'numeric', 'base', 'default']] } },
    };
    const additions = buildExpansionAdditions([tableNumericToken], cfg);
    expect(additions).toContain('  --ds-table-numeric-base-default-fvn: tabular-nums;');
  });

  it('does NOT match when prefix is longer than token path', () => {
    const cfg: Config = {
      ...baseCfg,
      typography: { fontVariantNumeric: { tabular: [['mono', 'base', 'default', 'extra']] } },
    };
    const additions = buildExpansionAdditions([monoToken], cfg);
    expect(additions.some((l) => l.includes('-fvn:'))).toBe(false);
  });
});
