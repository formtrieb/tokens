import type { UnitPolicy, UnitPreset, UnitTarget } from "../types.js";

/**
 * The unit policy for a Tokens-Studio export: sizes that should follow the
 * reader's font size in rem, borders and shadows in px, letter-spacing and
 * line heights as written (core already turned their `%` into em and a
 * factor).
 */
export const TOKENS_STUDIO_UNITS: Readonly<UnitPolicy> = Object.freeze({
  types: Object.freeze({
    fontSizes: "rem",
    spacing: "rem",
    sizing: "rem",
    borderRadius: "rem",
    paragraphSpacing: "rem",
    paragraphIndent: "rem",
    dimension: "rem",
    borderWidth: "px",
    boxShadow: "px",
    letterSpacing: "source",
    lineHeights: "source",
  }) as Record<string, UnitTarget>,
});

export const UNIT_PRESETS: Record<UnitPreset, UnitPolicy> = {
  source: {},
  "tokens-studio": TOKENS_STUDIO_UNITS,
};

export const UNIT_TARGETS: readonly UnitTarget[] = ["rem", "px", "source"];

export function unitPolicy(units: UnitPolicy | UnitPreset | undefined): UnitPolicy {
  if (units === undefined) return {};
  return typeof units === "string" ? UNIT_PRESETS[units] : units;
}

/** Whether a dot path matches a pattern: `*` one segment, `**` zero or more. */
export function matchPath(pattern: string, path: readonly string[]): boolean {
  const parts = pattern.split(".");
  const at = (p: number, s: number): boolean => {
    if (p === parts.length) return s === path.length;
    if (parts[p] === "**") return at(p + 1, s) || (s < path.length && at(p, s + 1));
    if (s === path.length) return false;
    return (parts[p] === "*" || parts[p] === path[s]) && at(p + 1, s + 1);
  };
  return at(0, 0);
}

/** The target for a length of a token: path rules, then its type, then its aligned type. */
export function unitTarget(policy: UnitPolicy, path: readonly string[], type: string | undefined, aligned: string | undefined): UnitTarget {
  for (const rule of policy.paths ?? []) if (matchPath(rule.match, path)) return rule.unit;
  const types = policy.types ?? {};
  const of = (t: string | undefined) => (t !== undefined && Object.hasOwn(types, t) ? types[t] : undefined);
  return of(type) ?? of(aligned) ?? "source";
}
