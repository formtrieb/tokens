/**
 * The typography builders read the companion variables
 * (`-letter-spacing`, `-text-transform`, …), which are written only with
 * `typographyCompanions`. Without them their `var()`s would point at nothing,
 * so they refuse.
 */
export function requireCompanions(builder: string, typographyCompanions: boolean | undefined): void {
  // a builder called outside renderUtilities gets no option and trusts its caller
  if (typographyCompanions !== false) return;
  throw new Error(
    `${builder} reads the typography companion variables, which are written only with typographyCompanions: true. ` +
      `Set the option, or set letter-spacing and the other properties from your own tokens.`
  );
}
