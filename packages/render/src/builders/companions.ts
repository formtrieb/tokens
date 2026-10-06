import type { Dialect } from "../types.js";

/**
 * The typography builders read the companion variables
 * (`-letter-spacing`, `-text-transform`, …) that only the
 * `'style-dictionary'` dialect writes. In any other dialect their `var()`s
 * would point at nothing, so they refuse.
 */
export function requireCompanions(builder: string, dialect: Dialect | undefined): void {
  // a builder called outside renderUtilities gets no dialect: that is the default, 'style-dictionary'
  if (dialect === undefined || dialect === "style-dictionary") return;
  throw new Error(
    `${builder} reads the typography companion variables, which the '${dialect}' dialect does not write. ` +
      `Use the 'style-dictionary' dialect, or set letter-spacing and the other properties from your own tokens.`
  );
}
