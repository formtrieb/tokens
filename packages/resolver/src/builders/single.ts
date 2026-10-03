import { matchGlob } from '../shared/token-tree.js';
import { toKebabCase } from '../shared/kebab.js';
import type { BuilderFn } from '../types.js';

interface SingleOptions {
  name: string;
  source: string;
  property: string;
}

function globPrefixLength(source: string): number {
  const segments = source.split('.');
  const wildcardIdx = segments.indexOf('*');
  // No wildcard → exact match: use everything except the last segment as the
  // prefix so the leaf is the final path segment.
  return wildcardIdx === -1 ? segments.length - 1 : wildcardIdx;
}

export function single(opts: SingleOptions): BuilderFn {
  return ({ tokens, config }) => {
    const matched = matchGlob(tokens, opts.source);
    const prefixLen = globPrefixLength(opts.source);
    const rules = matched.map((t) => {
      const leaf = toKebabCase(t.path.slice(prefixLen));
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
