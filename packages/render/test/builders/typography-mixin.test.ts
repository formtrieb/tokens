import { describe, it, expect } from 'vitest';
import { typographyMixin } from '../../src/builders/typography-mixin.js';
import type { BuilderConfig as Config, BuilderToken as Token } from '../../src/types.js';

const cfg: Config = { prefix: 'ds-' };
const tokens: Token[] = [];

describe('typographyMixin', () => {
  it('starts with the usage header', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    expect(out.content.startsWith(
      "/// Typography mixins — auto-generated.\n/// Apply a typography token to any selector via @include.\n///\n/// Usage:\n" +
        "///   @include typography('display-1');\n///   @include typography-paragraph('body-base-default');\n\n@mixin typography($token) {"
    )).toBe(true);
  });

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

  it('core mixin includes font-variant-numeric with -fvn variable and normal fallback', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    expect(out.content).toContain('font-variant-numeric: var(--ds-#{$token}-fvn, normal)');
  });

  it('paragraph mixin does NOT contain font-variant-numeric', async () => {
    const out = await typographyMixin()({ tokens, config: cfg });
    const paragraphMixin = out.content
      .split('@mixin')
      .find((b) => b.startsWith(' typography-paragraph'));
    expect(paragraphMixin).toBeDefined();
    expect(paragraphMixin).not.toContain('font-variant-numeric');
  });
});
