export interface RawToken {
  path: string[];
  dotPath: string;
  $type: string;
  $value: unknown;
  $extensions?: TokenExtensions;
  sourceSet: string;
  isSource: boolean;
}

export interface TokenExtensions {
  "studio.tokens"?: {
    modify?: ColorModifier;
  };
  "com.figma.scopes"?: string[];
}

export interface ColorModifier {
  type: "lighten" | "darken" | "alpha" | "mix";
  value: string;
  space: string;
}

export interface ResolutionStep {
  tokenPath: string;
  rawValue: unknown;
  sourceSet: string;
  modifier?: ColorModifier;
}

export interface ResolutionChain {
  steps: ResolutionStep[];
  finalValue: unknown;
  errors: string[];
  gamutClipped?: boolean;
  lchValue?: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  group: string;
  selectedTokenSets: Record<string, "enabled" | "source">;
}

export interface ThemeAxes {
  [group: string]: string;
}

export interface TokenSetInfo {
  name: string;
  layer: string;
  tokenCount: number;
}

export interface DesignRuleViolation {
  rule: string;
  path: string;
  expected: string;
  actual: string;
  severity: "error" | "warning" | "info";
}

export interface PlaceholderToken {
  path: string;
  sourceSet: string;
  context: string;
}

export interface StructuralDiff {
  identical: boolean;
  missingInA: string[];
  missingInB: string[];
  typeMismatches: Array<{ path: string; typeA: string; typeB: string }>;
}
