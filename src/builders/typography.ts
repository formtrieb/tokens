import { findByType } from '../shared/token-tree.js';
import { toKebabCase } from '../shared/kebab.js';
import type { BuilderFn } from '../types.js';

export function typography(): BuilderFn {
  const fn: BuilderFn = ({ tokens, config }) => {
    const typographyTokens = findByType(tokens, 'typography');
    const blocks: string[] = [];
    for (const token of typographyTokens) {
      const slug = toKebabCase(token.path);
      const baseVar = `--${config.prefix}${slug}`;
      blocks.push(
        `.${config.prefix}${slug} {\n` +
          `  font: var(${baseVar});\n` +
          `  letter-spacing: var(${baseVar}-letter-spacing);\n` +
          `  text-transform: var(${baseVar}-text-transform);\n` +
          `  text-decoration: var(${baseVar}-text-decoration);\n` +
          `}`
      );
      blocks.push(
        `.${config.prefix}${slug}--paragraph {\n` +
          `  text-indent: var(${baseVar}-text-indent);\n` +
          `  margin-block-end: var(${baseVar}-margin-block-end);\n` +
          `}`
      );
    }
    return { filename: 'typography.css', content: blocks.join('\n\n') + '\n' };
  };
  fn.builderName = 'typography';
  return fn;
}
