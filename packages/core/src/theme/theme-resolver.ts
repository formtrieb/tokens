import type { ThemeDefinition, ThemeAxes } from "../types.js";

/**
 * Axis name collecting themes that carry no `group` in $themes.json.
 * Tokens Studio leaves `group` out for themes that were never assigned one.
 */
export const UNGROUPED_AXIS = "Ungrouped";

export interface RawTheme {
  id: string;
  name: string;
  group?: string;
  selectedTokenSets: Record<string, string>;
  $figmaStyleReferences?: Record<string, string>;
  $figmaVariableReferences?: Record<string, string>;
  $figmaCollectionId?: string;
  $figmaModeId?: string;
}

export function parseThemes(raw: RawTheme[]): ThemeDefinition[] {
  return raw.map((t) => ({
    id: t.id,
    name: t.name,
    group: t.group?.trim() || UNGROUPED_AXIS,
    selectedTokenSets: Object.fromEntries(
      Object.entries(t.selectedTokenSets).map(([k, v]) => [
        k,
        v as "enabled" | "source",
      ])
    ),
  }));
}

export function buildAxisMap(
  themes: ThemeDefinition[]
): Map<string, ThemeDefinition[]> {
  const axisMap = new Map<string, ThemeDefinition[]>();
  for (const theme of themes) {
    const group = theme.group;
    if (!axisMap.has(group)) {
      axisMap.set(group, []);
    }
    axisMap.get(group)!.push(theme);
  }
  return axisMap;
}

export function getThemeByName(
  themes: ThemeDefinition[],
  group: string,
  name: string
): ThemeDefinition | undefined {
  return themes.find((t) => t.group === group && t.name === name);
}

export function getActiveSets(
  themes: ThemeDefinition[],
  axes: ThemeAxes
): { enabled: string[]; source: string[] } {
  const enabled = new Set<string>();
  const source = new Set<string>();

  for (const [group, themeName] of Object.entries(axes)) {
    const theme = getThemeByName(themes, group, themeName);
    if (!theme) continue;

    for (const [setName, status] of Object.entries(theme.selectedTokenSets)) {
      if (status === "enabled") {
        enabled.add(setName);
      } else if (status === "source") {
        source.add(setName);
      }
    }
  }

  return {
    enabled: [...enabled],
    source: [...source],
  };
}

export function getDefaultAxes(
  axisMap: Map<string, ThemeDefinition[]>
): ThemeAxes {
  const axes: ThemeAxes = {};
  for (const [group, themes] of axisMap) {
    if (themes.length > 0) {
      axes[group] = themes[0].name;
    }
  }
  return axes;
}

export function getAxisGroups(
  axisMap: Map<string, ThemeDefinition[]>
): string[] {
  return [...axisMap.keys()];
}

export function getThemesForGroup(
  axisMap: Map<string, ThemeDefinition[]>,
  group: string
): ThemeDefinition[] {
  return axisMap.get(group) ?? [];
}

export interface AxisDescriptor {
  axis: string;
  values: string[];
  /** The value getDefaultAxes() picks when this axis is unspecified. */
  default: string;
}

/**
 * The axes a token system actually offers, derived from its $themes.json.
 * Callers cannot know these up front — theme axes vary per design system.
 */
export function describeAxes(
  axisMap: Map<string, ThemeDefinition[]>
): AxisDescriptor[] {
  const descriptors: AxisDescriptor[] = [];
  for (const [group, themes] of axisMap) {
    if (themes.length > 0) {
      descriptors.push({
        axis: group,
        values: themes.map((t) => t.name),
        default: themes[0].name,
      });
    }
  }
  return descriptors;
}

export type AxisProblem =
  | {
      kind: "unknown-axis";
      axis: string;
      /** Axis names this token system defines. */
      available: string[];
      suggestion?: string;
    }
  | {
      kind: "unknown-value";
      axis: string;
      value: string;
      /** Theme names this axis defines. */
      available: string[];
      suggestion?: string;
    };

/**
 * Check an axis selection against the loaded themes.
 * getActiveSets() skips anything it cannot match, so an unchecked typo
 * silently resolves against the wrong token sets — run this first.
 */
export function validateAxes(
  axisMap: Map<string, ThemeDefinition[]>,
  axes: ThemeAxes
): AxisProblem[] {
  const problems: AxisProblem[] = [];
  const groups = [...axisMap.keys()];

  for (const [axis, value] of Object.entries(axes)) {
    const themes = axisMap.get(axis);
    if (!themes) {
      const suggestion = groups.find(
        (g) => g.toLowerCase() === axis.toLowerCase()
      );
      problems.push({
        kind: "unknown-axis",
        axis,
        available: groups,
        ...(suggestion && { suggestion }),
      });
      continue;
    }

    const values = themes.map((t) => t.name);
    if (!values.includes(value)) {
      const suggestion = values.find(
        (v) => v.toLowerCase() === value.toLowerCase()
      );
      problems.push({
        kind: "unknown-value",
        axis,
        value,
        available: values,
        ...(suggestion && { suggestion }),
      });
    }
  }

  return problems;
}
