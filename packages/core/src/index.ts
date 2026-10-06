// Types
export type {
  RawToken,
  TokenExtensions,
  ColorModifier,
  ResolutionStep,
  ResolutionChain,
  ThemeDefinition,
  ThemeAxes,
  TokenSetInfo,
  DesignRuleViolation,
  PlaceholderToken,
  StructuralDiff,
} from "./types.js";

// Parser
export { TokenTree } from "./parser/token-tree.js";
export { ReferenceResolver } from "./parser/reference-resolver.js";
export { evaluateMath, containsMath } from "./parser/math-evaluator.js";
export {
  resolveLchToHex,
  applyColorModifier,
  isLchFormula,
  isPlainColor,
  isInSrgbGamut,
  resolveLchToHexWithGamut,
  formatColor,
} from "./parser/color-resolver.js";
export type { ColorFormat, ModifierOutput } from "./parser/color-resolver.js";
export {
  oklchToHex,
  hexToOklch,
  contrastWcag,
  deltaE2000,
  deltaEOK,
  composite,
  withAlpha,
} from "./parser/color-functions.js";
export type { Oklch } from "./parser/color-functions.js";
export { findColorMatches } from "./parser/color-match.js";
export type {
  ColorCandidate,
  ColorMatchResult,
  NearestColorMatch,
} from "./parser/color-match.js";

// Canonicalize — Tokens Studio semantics of a resolved value
export {
  canonicalize,
  alignType,
  resolveMath,
  parseAndReduce,
  evaluateMathFor,
  pxFor,
  opacityFor,
  lineHeightFor,
  fontWeightFor,
  letterSpacingFor,
} from "./canonicalize/index.js";

// Theme
export {
  parseThemes,
  buildAxisMap,
  getThemeByName,
  getActiveSets,
  getDefaultAxes,
  getAxisGroups,
  getThemesForGroup,
  describeAxes,
  validateAxes,
  UNGROUPED_AXIS,
} from "./theme/theme-resolver.js";
export type {
  RawTheme,
  AxisDescriptor,
  AxisProblem,
} from "./theme/theme-resolver.js";

// Analyzer
export {
  findPlaceholders,
  findBrokenReferences,
  compareStructure,
} from "./analyzer/validation.js";
export {
  checkControlsInteractionMapping,
  checkComponentReferences,
  checkNamingConventions,
} from "./analyzer/design-rules.js";
