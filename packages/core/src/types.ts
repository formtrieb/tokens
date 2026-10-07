/** A Tokens Studio colour modifier as written in `$extensions["studio.tokens"].modify`. */
export interface ColorModifier {
  type: "lighten" | "darken" | "alpha" | "mix";
  value: string;
  space: string;
  /** The colour to mix towards; only read by `mix`. */
  color?: string;
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
