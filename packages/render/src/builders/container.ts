import { kebab } from "../kebab.js";
import type { BuilderFn } from "../types.js";

interface ContainerOptions {
  name: string;
  rules: Record<string, string>;
}

const REF_PATTERN = /^\{([a-z0-9.-]+)\}$/i;

/** One class with fixed rules; a `{token.path}` value becomes its variable. */
export function container(opts: ContainerOptions): BuilderFn {
  return ({ config }) => {
    const lines: string[] = [];
    for (const [prop, value] of Object.entries(opts.rules)) {
      const ref = value.match(REF_PATTERN);
      lines.push(ref ? `  ${prop}: var(--${config.prefix}${kebab(ref[1].split("."))});` : `  ${prop}: ${value};`);
    }
    return { filename: `${opts.name}.css`, content: `.${config.prefix}${opts.name} {\n${lines.join("\n")}\n}\n` };
  };
}
