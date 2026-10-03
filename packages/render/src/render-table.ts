import type { ThemeDefinition } from "@formtrieb/tokens-core";
import { kebab } from "./kebab.js";
import type { GroupBehavior, RenderRule, RenderTableConfig } from "./types.js";

/**
 * The default render table, derived from `$themes.json` and the resolver's
 * group config — exactly what the resolver's theme processor writes today:
 *
 *   - a group with one theme     → `:root`
 *   - a group with several       → `[data-{kebab(group)}="{name}"]`
 *   - one file per group         → `variables/{kebab(group)}.css`
 *   - references per group       → `themeGroups[group]`, else
 *                                  `defaultGroupBehavior`, else true
 *
 * Rules keep `$themes.json` order; within a file that is the block order.
 * Nothing here knows a set, group or theme name — all of it comes from the
 * input. That is the guard against a recipe's structure leaking into render.
 */
export function deriveRenderTable(
  themes: readonly ThemeDefinition[],
  config: RenderTableConfig = {}
): RenderRule[] {
  const groups = new Map<string, ThemeDefinition[]>();
  for (const theme of themes) {
    const members = groups.get(theme.group);
    if (members) members.push(theme);
    else groups.set(theme.group, [theme]);
  }

  const rules: RenderRule[] = [];
  for (const [group, members] of groups) {
    const name = kebab(group);
    const references = behavior(group, config).useReferences;
    for (const theme of members) {
      rules.push({
        theme: `${theme.group}/${theme.name}`,
        selector: members.length === 1 ? ":root" : `[data-${name}="${theme.name}"]`,
        references,
        file: `variables/${name}.css`,
      });
    }
  }
  return rules;
}

function behavior(group: string, config: RenderTableConfig): GroupBehavior {
  return config.themeGroups?.[group] ?? config.defaultGroupBehavior ?? { useReferences: true };
}
