import { describe, it, expect } from 'vitest';
import { typographyMixin } from './typography-mixin.js';
import type { Config, Token } from '../types.js';

const cfg: Config = { prefix: 'ds-', paths: { tokens: '', output: '', tokenMap: '' } };
const tokens: Token[] = [];

describe('typographyMixin', () => {
  it('emits a SCSS partial with two mixins', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    expect(out.filename).toBe('_typography.scss');
    expect(out.content).toContain('@mixin typography($token)');
    expect(out.content).toContain('@mixin typography-paragraph($token)');
  });

  it('core mixin uses font shorthand + letter-spacing/transform/decoration', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    expect(out.content).toContain('font: var(--ds-#{$token})');
    expect(out.content).toContain('letter-spacing: var(--ds-#{$token}-letter-spacing)');
    expect(out.content).toContain('text-transform: var(--ds-#{$token}-text-transform)');
    expect(out.content).toContain('text-decoration: var(--ds-#{$token}-text-decoration)');
  });

  it('paragraph mixin uses text-indent + margin-block-end', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    expect(out.content).toContain('text-indent: var(--ds-#{$token}-text-indent)');
    expect(out.content).toContain('margin-block-end: var(--ds-#{$token}-margin-block-end)');
  });
});
