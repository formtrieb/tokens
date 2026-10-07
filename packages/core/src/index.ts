// System — load a token system, compose a theme, resolve to typed values
export {
  buildTokenSystem,
  namedSets,
  compose,
  composeTheme,
  themeSelection,
  resolveToken,
  resolveDictionary,
  referencesIn,
  textOf,
  alignType,
} from "./system/index.js";
export type {
  TokenSystem,
  SetSelection,
  Dictionary,
  DictionaryEntry,
  TokenValue,
  ShadowLayer,
  Expr,
  Color,
  TokenProblem,
  ChainStep,
  Resolution,
} from "./system/index.js";
export type { ColorModifier } from "./types.js";

// Colour — read, write, modify, measure, layer, find
export { parseColor } from "./color/parse.js";
export { cssColor } from "./color/css.js";
export { modifyColor } from "./color/modifiers.js";
export {
  oklchToHex,
  hexToOklch,
  contrastWcag,
  deltaE2000,
  deltaEOK,
  over,
  withAlpha,
  alphaOf,
  isInSrgbGamut,
} from "./color/functions.js";
export { findColorMatches } from "./color/match.js";
export type { ColorCandidate } from "./color/match.js";

// Themes and axes
export {
  parseThemes,
  buildAxisMap,
  getThemeByName,
  getDefaultAxes,
  describeAxes,
  validateAxes,
} from "./theme/themes.js";
export type { ThemeDefinition, ThemeAxes } from "./types.js";
export type { AxisProblem } from "./theme/themes.js";

// Analysis
export { findPlaceholders, findBrokenReferences, compareStructure } from "./analyze/validation.js";
export {
  checkControlsInteractionMapping,
  checkComponentReferences,
  checkNamingConventions,
} from "./analyze/design-rules.js";
export type { PlaceholderToken, StructuralDiff, DesignRuleViolation } from "./types.js";
