import type { RawToken, DesignRuleViolation } from "../types.js";

export function checkControlsInteractionMapping(
  tokens: RawToken[]
): DesignRuleViolation[] {
  const violations: DesignRuleViolation[] = [];

  const controlsTokens = tokens.filter(
    (t) =>
      t.dotPath.startsWith("color.controls.") && typeof t.$value === "string"
  );

  for (const token of controlsTokens) {
    const value = token.$value as string;

    const refs = extractReferences(value);
    if (refs.length === 0) continue;

    const property = getControlsProperty(token.path);
    if (!property) continue;

    for (const ref of refs) {
      const violation = checkPropertyReferenceConsistency(
        token.dotPath,
        property,
        ref
      );
      if (violation) violations.push(violation);
    }
  }

  return violations;
}

export function checkComponentReferences(
  tokens: RawToken[]
): DesignRuleViolation[] {
  const violations: DesignRuleViolation[] = [];

  const componentTokens = tokens.filter(
    (t) =>
      t.sourceSet.startsWith("Components/") && typeof t.$value === "string"
  );

  for (const token of componentTokens) {
    const refs = extractReferences(token.$value as string);
    for (const ref of refs) {
      if (ref.startsWith("color.interaction.")) {
        violations.push({
          rule: "component-uses-interaction-directly",
          path: token.dotPath,
          expected: "Reference to color.controls.* or other semantic token",
          actual: `References ${ref} directly`,
          severity: "info",
        });
      }
    }
  }

  return violations;
}

const STANDARD_SEGMENTS: Record<string, Set<string>> = {
  hierarchy: new Set(["primary", "secondary", "tertiary", "brand"]),
  element: new Set([
    "background", "stroke", "text", "text-on-color", "icon", "icon-on-color",
  ]),
  interaction: new Set(["default", "hover", "active", "disabled", "inactive"]),
  intent: new Set(["positive", "negative", "warning", "info", "neutral"]),
};

export function checkNamingConventions(
  tokens: RawToken[]
): DesignRuleViolation[] {
  const violations: DesignRuleViolation[] = [];

  for (const token of tokens) {
    const segments = token.path;

    // 1. Non-standard segment names in controls paths
    if (
      segments[0] === "color" &&
      segments[1] === "controls" &&
      segments.length >= 5
    ) {
      const hierarchy = segments[2];
      const element = segments[3];
      const interaction = segments[4];

      if (!STANDARD_SEGMENTS.hierarchy.has(hierarchy)) {
        violations.push({
          rule: "non-standard-segment",
          path: token.dotPath,
          expected: `Standard hierarchy: ${[...STANDARD_SEGMENTS.hierarchy].join(", ")}`,
          actual: `Uses "${hierarchy}"`,
          severity: "info",
        });
      }
      if (!STANDARD_SEGMENTS.element.has(element)) {
        violations.push({
          rule: "non-standard-segment",
          path: token.dotPath,
          expected: `Standard element: ${[...STANDARD_SEGMENTS.element].join(", ")}`,
          actual: `Uses "${element}"`,
          severity: "info",
        });
      }
      if (!STANDARD_SEGMENTS.interaction.has(interaction)) {
        violations.push({
          rule: "non-standard-segment",
          path: token.dotPath,
          expected: `Standard interaction: ${[...STANDARD_SEGMENTS.interaction].join(", ")}`,
          actual: `Uses "${interaction}"`,
          severity: "info",
        });
      }
    }

    // 2. Deep nesting (>6 segments is unusual)
    if (segments.length > 6) {
      violations.push({
        rule: "deep-nesting",
        path: token.dotPath,
        expected: "Token path with 6 or fewer segments",
        actual: `${segments.length} segments`,
        severity: "info",
      });
    }

    // 3. Redundant reference (token references a sibling at the same level)
    if (typeof token.$value === "string") {
      const refs = extractReferences(token.$value);
      const tokenParent = token.path.slice(0, -1).join(".");
      for (const ref of refs) {
        const refParts = ref.split(".");
        const refParent = refParts.slice(0, -1).join(".");
        if (refParent === tokenParent && refParts.length === token.path.length) {
          violations.push({
            rule: "sibling-reference",
            path: token.dotPath,
            expected: "Reference to a different level or group",
            actual: `References sibling ${ref}`,
            severity: "info",
          });
        }
      }
    }
  }

  return violations;
}

function getControlsProperty(path: string[]): string | null {
  if (path.length < 5) return null;
  if (path[0] !== "color" || path[1] !== "controls") return null;
  return path[3];
}

function checkPropertyReferenceConsistency(
  tokenPath: string,
  property: string,
  ref: string
): DesignRuleViolation | null {
  const expectedMapping: Record<string, string[]> = {
    icon: ["color.interaction.icon."],
    "icon-on-color": ["color.interaction.icon-on-color."],
    text: ["color.text.", "color.interaction.text."],
    "text-on-color": ["color.text.", "color.interaction.text-on-color."],
    background: ["color.interaction.background."],
    stroke: ["color.interaction.stroke.", "color.interaction.background."],
  };

  const expectedPrefixes = expectedMapping[property];
  if (!expectedPrefixes) return null;

  if (ref.startsWith("color.controls.")) return null;

  if (!ref.startsWith("color.interaction.") && !ref.startsWith("color.text.")) {
    return null;
  }

  const matchesExpected = expectedPrefixes.some((prefix) =>
    ref.startsWith(prefix)
  );

  if (!matchesExpected) {
    return {
      rule: "controls-interaction-category-mismatch",
      path: tokenPath,
      expected: `Reference to ${expectedPrefixes.join(" or ")}`,
      actual: `References ${ref}`,
      severity: "error",
    };
  }

  return null;
}

function extractReferences(value: string): string[] {
  const refs: string[] = [];
  const pattern = /\{([^}]+)\}/g;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}
