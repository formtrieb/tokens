import { kebab } from "../kebab.js";
import type { BuilderFn } from "../types.js";
import { requireCompanions } from "./companions.js";
import { findByType } from "./tokens.js";

/**
 * One class per typography token: the `font` shorthand plus the companion
 * properties the variables carry, and a `--paragraph` class for spacing.
 */
export function typography(): BuilderFn {
  const fn: BuilderFn = ({ tokens, config, typographyCompanions }) => {
    requireCompanions("typography()", typographyCompanions);
    const blocks: string[] = [];
    for (const token of findByType(tokens, "typography")) {
      const slug = kebab(token.path);
      const base = `--${config.prefix}${slug}`;
      blocks.push(
        `.${config.prefix}${slug} {\n` +
          `  font: var(${base});\n` +
          `  letter-spacing: var(${base}-letter-spacing);\n` +
          `  text-transform: var(${base}-text-transform);\n` +
          `  text-decoration: var(${base}-text-decoration);\n` +
          `  font-variant-numeric: var(${base}-fvn, normal);\n` +
          `}`
      );
      blocks.push(
        `.${config.prefix}${slug}--paragraph {\n` +
          `  text-indent: var(${base}-text-indent);\n` +
          `  margin-block-end: var(${base}-margin-block-end);\n` +
          `}`
      );
    }
    return { filename: "typography.css", content: blocks.join("\n\n") + "\n" };
  };
  fn.builderName = "typography";
  return fn;
}
