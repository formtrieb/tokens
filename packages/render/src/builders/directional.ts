import { kebab } from "../kebab.js";
import type { BuilderFn } from "../types.js";
import { globPrefixLength, matchGlob } from "./tokens.js";

export type Side = "t" | "b" | "s" | "e" | "x" | "y" | "all";

interface DirectionalOptions {
  name: string;
  source: string;
  property: string;
  sides: Side[];
}

const SIDE_TO_LOGICAL_AXIS: Record<Side, string> = {
  t: "-block-start",
  b: "-block-end",
  s: "-inline-start",
  e: "-inline-end",
  x: "-inline",
  y: "-block",
  all: "",
};

/** One class per matched token and side, on logical properties (`padding-block-start`, …). */
export function directional(opts: DirectionalOptions): BuilderFn {
  return ({ tokens, config }) => {
    const prefixLen = globPrefixLength(opts.source);
    const rules: string[] = [];
    for (const t of matchGlob(tokens, opts.source)) {
      const leaf = kebab(t.path.slice(prefixLen));
      const cssVar = `--${config.prefix}${kebab(t.path)}`;
      for (const side of opts.sides) {
        const suffix = side === "all" ? "" : `-${side}`;
        rules.push(`.${config.prefix}${opts.name}${suffix}-${leaf} { ${opts.property}${SIDE_TO_LOGICAL_AXIS[side]}: var(${cssVar}); }`);
      }
    }
    return { filename: `${opts.name}.css`, content: rules.join("\n") + "\n" };
  };
}
