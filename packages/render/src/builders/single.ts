import { kebab } from "../kebab.js";
import type { BuilderFn } from "../types.js";
import { globPrefixLength, matchGlob } from "./tokens.js";

interface SingleOptions {
  name: string;
  source: string;
  property: string;
}

/** One class per matched token, one property. */
export function single(opts: SingleOptions): BuilderFn {
  return ({ tokens, config }) => {
    const prefixLen = globPrefixLength(opts.source);
    const rules = matchGlob(tokens, opts.source).map((t) => {
      const leaf = kebab(t.path.slice(prefixLen));
      return `.${config.prefix}${opts.name}-${leaf} { ${opts.property}: var(--${config.prefix}${kebab(t.path)}); }`;
    });
    return { filename: `${opts.name}.css`, content: rules.join("\n") + "\n" };
  };
}
