import { matchGlob } from '../shared/token-tree.js';
import { toKebabCase } from '../shared/kebab.js';
import type { BuilderFn } from '../types.js';

export type Side = 't' | 'b' | 's' | 'e' | 'x' | 'y' | 'all';

interface DirectionalOptions {
  name: string;
  source: string;
  property: string;
  sides: Side[];
}

const SIDE_TO_LOGICAL_AXIS: Record<Side, string> = {
  t: '-block-start',
  b: '-block-end',
  s: '-inline-start',
  e: '-inline-end',
  x: '-inline',
  y: '-block',
  all: '',
};

function cssPropertyFor(property: string, side: Side): string {
  return property + SIDE_TO_LOGICAL_AXIS[side];
}

export function directional(opts: DirectionalOptions): BuilderFn {
  return ({ tokens, config }) => {
    const matched = matchGlob(tokens, opts.source);
    const prefixSegments = opts.source.split('.').slice(0, opts.source.split('.').indexOf('*'));
    const rules: string[] = [];
    for (const t of matched) {
      const leaf = toKebabCase(t.path.slice(prefixSegments.length));
      const cssVar = `--${config.prefix}${toKebabCase(t.path)}`;
      for (const side of opts.sides) {
        const sideSuffix = side === 'all' ? '' : `-${side}`;
        const className = `.${config.prefix}${opts.name}${sideSuffix}-${leaf}`;
        const cssProp = cssPropertyFor(opts.property, side);
        rules.push(`${className} { ${cssProp}: var(${cssVar}); }`);
      }
    }
    return { filename: `${opts.name}.css`, content: rules.join('\n') + '\n' };
  };
}
