import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDefaultAxes } from "@formtrieb/tokens-core";
import { compositionFor, selectionFor } from "../composition.js";
import { resolveAndLoad, TOKENS_PATH_DESCRIPTION } from "../token-context.js";
import { assertType, colorForm, display, formatArg, TYPE_DESCRIPTION } from "./present.js";
import { themeAxesArg, THEME_AXES_DESCRIPTION, resolveAxes } from "./theme-arg.js";

export function registerThemeTools(server: McpServer) {
  server.registerTool(
    "list_themes",
    {
      description:
        "List all available themes grouped by axis, as defined by the loaded $themes.json. Axis names are design-system specific (Semantic/Device/Shape in one system, Brand/Density in another). Call this first to discover which axes and values are valid for the theme arguments of other tools; `defaults` names the value each axis falls back to. Themes without a group in $themes.json collect under the `Ungrouped` axis.",
      inputSchema: {
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const { axisMap } = resolveAndLoad(args);
      const axes: Record<string, Array<{ name: string; id: string; enabledSets: string[]; sourceSets: string[] }>> = {};
      for (const [group, themes] of axisMap) {
        axes[group] = themes.map((t) => ({
          name: t.name,
          id: t.id,
          enabledSets: Object.entries(t.selectedTokenSets).filter(([, v]) => v === "enabled").map(([k]) => k),
          sourceSets: Object.entries(t.selectedTokenSets).filter(([, v]) => v === "source").map(([k]) => k),
        }));
      }
      const defaults = getDefaultAxes(axisMap);
      return { content: [{ type: "text" as const, text: JSON.stringify({ axes, defaults }, null, 2) }] };
    }
  );

  server.registerTool(
    "compose_theme",
    {
      description:
        "Show which token sets are active for a given theme combination. Axes left out fall back to their defaults and are listed in `defaulted`. A set is enabled when a chosen theme enables it, else source when one names it as source; within each, $metadata.json order.",
      inputSchema: {
        axes: themeAxesArg.describe(THEME_AXES_DESCRIPTION),
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ axes, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const resolved = resolveAxes(axes, ctx.axisMap);
      const selection = selectionFor(ctx.system, resolved.axes);
      const out = {
        axes: resolved.axes,
        defaulted: resolved.defaulted.length > 0 ? resolved.defaulted : undefined,
        enabled: selection.filter((s) => s.state === "enabled").map((s) => s.set),
        source: selection.filter((s) => s.state === "source").map((s) => s.set),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    }
  );

  server.registerTool(
    "compare_themes",
    {
      description:
        "Compare resolved token values between two theme configurations; axes left out fall back to their defaults. Values are compared as @formtrieb/tokens-render writes them. Returns which paths differ and their values. Hard cap: 200 changed paths, 50 per only-in-A/B list.",
      inputSchema: {
        theme_a: themeAxesArg.describe(`First theme. ${THEME_AXES_DESCRIPTION}`),
        theme_b: themeAxesArg.describe(`Second theme. ${THEME_AXES_DESCRIPTION}`),
        path_prefix: z.string().optional().describe("Narrow comparison to a dot-path subtree (e.g. 'color.text')"),
        type: z.string().optional().describe(TYPE_DESCRIPTION),
        format: formatArg,
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ theme_a, theme_b, path_prefix, type, format, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const axesA = resolveAxes(theme_a, ctx.axisMap).axes;
      const axesB = resolveAxes(theme_b, ctx.axisMap).axes;
      const a = compositionFor(ctx, selectionFor(ctx.system, axesA));
      const b = compositionFor(ctx, selectionFor(ctx.system, axesB));
      if (type) assertType(type, [...a.dict.entries, ...b.dict.entries]);
      const color = colorForm(format);

      const changed: Array<{ path: string; valueA: string; valueB: string }> = [];
      const onlyInA: string[] = [];
      const onlyInB: string[] = [];
      const paths = new Set([...a.dict.byKey.keys(), ...b.dict.byKey.keys()]);
      for (const path of paths) {
        if (path_prefix && !path.startsWith(path_prefix)) continue;
        const ea = a.dict.byKey.get(path);
        const eb = b.dict.byKey.get(path);
        if (type && ((ea && ea.type !== type) || (eb && eb.type !== type))) continue;
        const inA = ea?.emitted === true;
        const inB = eb?.emitted === true;
        if (!inA && !inB) continue;
        if (!inB) {
          onlyInA.push(path);
          continue;
        }
        if (!inA) {
          onlyInB.push(path);
          continue;
        }
        const valueA = display(a.values.get(path)!, ea!, color);
        const valueB = display(b.values.get(path)!, eb!, color);
        if (valueA !== valueB) changed.push({ path, valueA, valueB });
      }

      const CHANGED_LIMIT = 200;
      const ONLY_LIMIT = 50;
      const limited = (list: string[]) =>
        list.length > ONLY_LIMIT ? { showing: ONLY_LIMIT, total: list.length, paths: list.slice(0, ONLY_LIMIT) } : list;
      const out = {
        theme_a: axesA,
        theme_b: axesB,
        summary: { changed: changed.length, onlyInA: onlyInA.length, onlyInB: onlyInB.length },
        ...(changed.length > CHANGED_LIMIT && {
          note: `Showing ${CHANGED_LIMIT} of ${changed.length} changed paths. Refine path_prefix to narrow down.`,
        }),
        changed: changed.slice(0, CHANGED_LIMIT),
        onlyInA: limited(onlyInA),
        onlyInB: limited(onlyInB),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    }
  );
}
