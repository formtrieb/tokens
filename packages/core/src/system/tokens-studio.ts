/**
 * What Tokens Studio's types and words mean: which type the meaning rules
 * key on (`fontSizes` reads like `fontSize`, `spacing` like `dimension`),
 * and which weight a font-weight name stands for.
 */

const ALIGNED_TYPES: Record<string, string> = {
  fontFamilies: "fontFamily",
  fontWeights: "fontWeight",
  fontSizes: "fontSize",
  lineHeights: "lineHeight",
  boxShadow: "shadow",
  spacing: "dimension",
  sizing: "dimension",
  borderRadius: "dimension",
  borderWidth: "dimension",
  letterSpacing: "dimension",
  paragraphSpacing: "dimension",
  paragraphIndent: "dimension",
  text: "content",
};

/**
 * Tokens Studio type → the type the meaning rules key on. A `letterSpacing`
 * becomes `dimension`; the token keeps its own type next to it.
 */
export function alignType(type: string | undefined): string | undefined {
  return type === undefined ? undefined : Object.hasOwn(ALIGNED_TYPES, type) ? ALIGNED_TYPES[type] : type;
}

const FONT_WEIGHTS: Record<string, number> = {
  hairline: 100, thin: 100,
  extralight: 200, ultralight: 200, extraleicht: 200,
  light: 300, leicht: 300,
  normal: 400, regular: 400, buch: 400, book: 400,
  medium: 500, kraeftig: 500, kräftig: 500,
  semibold: 600, demibold: 600, halbfett: 600,
  bold: 700, dreiviertelfett: 700,
  extrabold: 800, ultrabold: 800, fett: 800,
  black: 900, heavy: 900, super: 900, extrafett: 900,
  ultra: 950, ultrablack: 950, extrablack: 950,
};
const FONT_STYLES = ["italic", "oblique", "normal"];
const FONT_WEIGHT_RE = new RegExp(`(?<weight>.+?)\\s?(?<style>${FONT_STYLES.join("|")})?$`, "i");

/**
 * A font weight as a number and an optional style: `Bold` → 700,
 * `Bold Italic` → 700 italic, `600` → 600. Undefined for a name no table knows.
 */
export function fontWeight(text: string): { value: number; style?: "italic" | "oblique" } | undefined {
  const match = text.trim().match(FONT_WEIGHT_RE);
  if (!match?.groups) return undefined;
  const name = match.groups.weight!.toLowerCase();
  const style = match.groups.style?.toLowerCase();
  const value = Object.hasOwn(FONT_WEIGHTS, name.replace(/\s/g, "")) ? FONT_WEIGHTS[name.replace(/\s/g, "")] : Number(name);
  if (value === undefined || !Number.isFinite(value) || !/^\d+$/.test(`${value}`)) return undefined;
  return style === "italic" || style === "oblique" ? { value, style } : { value };
}
