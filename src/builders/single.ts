import { matchGlob } from '../shared/token-tree.js';
import { toKebabCase } from '../shared/kebab.js';
import type { BuilderFn } from '../types.js';

interface SingleOptions {
  name: string;
  source: string;
  property: string;
  /** Override the default leaf-extraction behavior */
  stripPrefix?: string;
}

export function single(opts: SingleOptions): BuilderFn {
  return ({ tokens, config }) => {
    const matched = matchGlob(tokens, opts.source);
    const prefixSegments = opts.source.split('.').slice(0, opts.source.split('.').indexOf('*'));
    const rules = matched.map((t) => {
      const leaf = toKebabCase(t.path.slice(prefixSegments.length));
      const fullVar = `--${config.prefix}${toKebabCase(t.path)}`;
      const className = `.${config.prefix}${opts.name}-${leaf}`;
      return `${className} { ${opts.property}: var(${fullVar}); }`;
    });
    return {
      filename: `${opts.name}.css`,
      content: rules.join('\n') + '\n',
    };
  };
}
