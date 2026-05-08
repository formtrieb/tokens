import { toKebabCase } from '../shared/kebab.js';
import type { BuilderFn } from '../types.js';

interface ContainerOptions {
  name: string;
  rules: Record<string, string>;
}

const REF_PATTERN = /^\{([a-z0-9.-]+)\}$/i;

export function container(opts: ContainerOptions): BuilderFn {
  return ({ config }) => {
    const lines: string[] = [];
    for (const [prop, value] of Object.entries(opts.rules)) {
      const refMatch = value.match(REF_PATTERN);
      if (refMatch) {
        const tokenPath = refMatch[1].split('.');
        const cssVar = `--${config.prefix}${toKebabCase(tokenPath)}`;
        lines.push(`  ${prop}: var(${cssVar});`);
      } else {
        lines.push(`  ${prop}: ${value};`);
      }
    }
    const content = `.${config.prefix}${opts.name} {\n${lines.join('\n')}\n}\n`;
    return { filename: `${opts.name}.css`, content };
  };
}
