import { describe, it, expect } from 'vitest';
import { typography } from './typography.js';
import type { Config, Token } from '../types.js';

const cfg: Config = { prefix: 'ds-', paths: { tokens: '', output: '', tokenMap: '' } };

const typographyTokens: Token[] = [
  {
    path: ['Display 1'],
    value: { fontFamily: '...', fontSize: '...' },
    $type: 'typography',
    raw: {},
  },
  {
    path: ['Body', 'Base', 'Default'],
    value: { fontFamily: '...' },
    $type: 'typography',
    raw: {},
  },
];

describe('typography', () => {
  it('emits one core class per typography token', async () => {
    const out = await typography()({ tokens: typographyTokens, config: cfg });
    expect(out.content).toContain('.ds-display-1 {');
    expect(out.content).toContain('.ds-body-base-default {');
  });

  it('core class includes font shorthand + 3 layout-safe properties', async () => {
    const out = await typography()({ tokens: typographyTokens, config: cfg });
    expect(out.content).toContain('font: var(--ds-display-1)');
    expect(out.content).toContain('letter-spacing: var(--ds-display-1-letter-spacing)');
    expect(out.content).toContain('text-transform: var(--ds-display-1-text-transform)');
    expect(out.content).toContain('text-decoration: var(--ds-display-1-text-decoration)');
  });

  it('emits a separate --paragraph class with text-indent + margin-block-end', async () => {
    const out = await typography()({ tokens: typographyTokens, config: cfg });
    expect(out.content).toContain('.ds-display-1--paragraph {');
    expect(out.content).toContain('text-indent: var(--ds-display-1-text-indent)');
    expect(out.content).toContain('margin-block-end: var(--ds-display-1-margin-block-end)');
  });

  it('uses typography.css as filename', async () => {
    const out = await typography()({ tokens: typographyTokens, config: cfg });
    expect(out.filename).toBe('typography.css');
  });

  it('ignores tokens with other $types', async () => {
    const mixed: Token[] = [
      ...typographyTokens,
      { path: ['colors', 'brand'], value: '#fff', $type: 'color', raw: {} },
    ];
    const out = await typography()({ tokens: mixed, config: cfg });
    expect(out.content).not.toContain('colors-brand');
  });

  it('exposes builderName: "typography" for validation', () => {
    const fn = typography();
    expect(fn.builderName).toBe('typography');
  });
});
