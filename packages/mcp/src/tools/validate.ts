import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { designReport, findPlaceholders } from "@formtrieb/tokens-core";
import { loadRules, RULES_FILE } from "../rules.js";
import { compositionFor, selectionFor, tokensOf } from "../composition.js";
import { themeAxesArg, THEME_AXES_DESCRIPTION, resolveAxes } from "./theme-arg.js";
import { resolveAndLoad, TOKENS_PATH_DESCRIPTION } from "../token-context.js";

export function registerValidateTools(server: McpServer) {
  server.registerTool(
    "find_placeholders",
    {
      description:
        "Find all placeholder tokens (#f305b7 magenta) that mark undefined states needing real values. Use to audit token completeness.",
      inputSchema: {
        set: z
          .string()
          .optional()
          .describe(
            "Limit to a specific set (e.g. 'Brand/Acme') or layer (e.g. 'Brand'). Omit to scan all sets."
          ),
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ set, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const tokens = tokensOf(ctx, set);
      const placeholders = findPlaceholders(tokens, set);

      const byContext: Record<string, string[]> = {};
      for (const p of placeholders) {
        const key = p.context;
        if (!byContext[key]) byContext[key] = [];
        byContext[key].push(p.path);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: placeholders.length,
                byContext,
                all: placeholders,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "check_design_rules",
    {
      description:
        `Check tokens against design rules given as data, plus structural checks: problems of resolving an axis selection (unknown references, cycles, …), references to nothing, and parity of the themes of one axis (which tokens each theme's enabled sets define). Rules come from the \`rules\` argument, a \`rules_path\`, or ${RULES_FILE} next to the token folder; without rules only the structural checks run. Reports violations grouped by rule and names where the rules came from.`,
      inputSchema: {
        set: z.string().optional().describe("Limit to a specific set or layer. Omit for system-wide check."),
        severity: z
          .enum(["error", "warning", "info"])
          .default("warning")
          .describe("Minimum severity level to report. 'error' shows only errors, 'info' shows everything."),
        rules: z
          .object({ rules: z.array(z.record(z.string(), z.unknown())) })
          .optional()
          .describe(
            "Design rules as data: { rules: [{ rule, kind: 'references' | 'segments' | 'depth' | 'sibling-reference', tokens?, sets?, severity?, … }] }. Overrides any rules file."
          ),
        rules_path: z.string().optional().describe(`Path to a rules file. Default: ${RULES_FILE} in the folder that holds the token folder.`),
        axis: z
          .string()
          .optional()
          .describe("Theme axis whose themes are compared for parity. Default: the first axis with more than one theme."),
        theme: themeAxesArg.optional().describe(`Axis selection whose resolution problems are reported. ${THEME_AXES_DESCRIPTION}`),
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ set, severity, rules, rules_path, axis, theme, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const loaded = loadRules({ rules, rules_path }, ctx.path);

      // Parity: the tokens each theme of one axis enables (not with a set filter).
      let parity: { axis: string; themes: { name: string; entries: ReturnType<typeof tokensOf> }[] } | undefined;
      if (!set) {
        if (axis !== undefined && !ctx.axisMap.has(axis)) {
          throw new Error(`Unknown theme axis "${axis}". Axes in this token system: ${[...ctx.axisMap.keys()].join(", ")}`);
        }
        const name = axis ?? [...ctx.axisMap].find(([, themes]) => themes.length > 1)?.[0];
        if (name !== undefined) {
          parity = {
            axis: name,
            themes: ctx.axisMap.get(name)!.map((t) => ({
              name: t.name,
              entries: Object.entries(t.selectedTokenSets)
                .filter(([s, state]) => state === "enabled" && ctx.system.sets.has(s))
                .flatMap(([s]) => tokensOf(ctx, s)),
            })),
          };
        }
      }

      // Resolution of one axis selection: the server's unit.
      const { axes } = resolveAxes(theme, ctx.axisMap);
      const scope = Object.entries(axes).map(([a, v]) => `${a}=${v}`).join(", ") || "(no themes)";
      const problems = [...ctx.loadProblems, ...compositionFor(ctx, selectionFor(ctx.system, axes)).problems];

      const report = designReport({
        entries: tokensOf(ctx, set),
        rules: loaded.rules,
        severity,
        parity,
        resolution: [{ scope, problems }],
      });
      const out = { rules: loaded.source, ...report };
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    }
  );
}
