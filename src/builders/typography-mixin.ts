import type { BuilderFn } from '../types.js';

const HEADER = `/// Typography mixins — auto-generated.
/// Apply a typography token to any selector via @include.
///
/// Usage:
///   @include typography('display-1');
///   @include typography-paragraph('body-base-default');
`;

export function typographyMixin(): BuilderFn {
  return ({ config }) => {
    const p = config.prefix;
    const content =
      HEADER +
      `\n@mixin typography($token) {\n` +
      `  font: var(--${p}#{$token});\n` +
      `  letter-spacing: var(--${p}#{$token}-letter-spacing);\n` +
      `  text-transform: var(--${p}#{$token}-text-transform);\n` +
      `  text-decoration: var(--${p}#{$token}-text-decoration);\n` +
      `}\n\n` +
      `@mixin typography-paragraph($token) {\n` +
      `  text-indent: var(--${p}#{$token}-text-indent);\n` +
      `  margin-block-end: var(--${p}#{$token}-margin-block-end);\n` +
      `}\n`;
    return { filename: '_typography.scss', content };
  };
}
