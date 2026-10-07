import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkRules, compareStructure, findBrokenReferences, findPlaceholders } from "@formtrieb/tokens-core";
import { loadRules, RULES_FILE } from "../rules.js";
import { tokensOf } from "../composition.js";
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
        `Check tokens against design rules given as data, plus structural checks: references to nothing, and parity of the themes of one axis (which tokens each theme's enabled sets define). Rules come from the \`rules\` argument, a \`rules_path\`, or ${RULES_FILE} next to the token folder; without rules only the structural checks run. Reports violations grouped by rule and names where the rules came from.`,
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
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ set, severity, rules, rules_path, axis, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const loaded = loadRules({ rules, rules_path }, ctx.path);
      const tokens = tokensOf(ctx, set);
      const allPaths = new Set(tokens.map((t) => t.key));
      const brokenRefs = findBrokenReferences(tokens, allPaths);

      const severityOrder = { error: 0, warning: 1, info: 2 };
      const minLevel = severityOrder[severity];
      const allViolations = (loaded.rules ? checkRules(tokens, loaded.rules) : []).filter(
        (v) => severityOrder[v.severity] <= minLevel
      );

      // Group violations by rule for compact output; `affected` lists the groups the tokens sit in.
      const byRule: Record<string, { count: number; severity: string; affected: string[]; example: { path: string; expected: string; actual: string } }> = {};
      for (const v of allViolations) {
        const entry = (byRule[v.rule] ??= {
          count: 0,
          severity: v.severity,
          affected: [],
          example: { path: v.path, expected: v.expected, actual: v.actual },
        });
        entry.count++;
        const group = v.path.split(".").slice(0, -1).join(".") || v.path;
        if (!entry.affected.includes(group)) entry.affected.push(group);
      }

      // Parity: the tokens each theme of one axis enables, the first theme against each other.
      let parity: unknown = "not checked";
      if (!set) {
        if (axis !== undefined && !ctx.axisMap.has(axis)) {
          throw new Error(`Unknown theme axis "${axis}". Axes in this token system: ${[...ctx.axisMap.keys()].join(", ")}`);
        }
        const name = axis ?? [...ctx.axisMap].find(([, themes]) => themes.length > 1)?.[0];
        const themes = name !== undefined ? ctx.axisMap.get(name)! : [];
        if (themes.length > 1) {
          const tokensOfTheme = (t: (typeof themes)[number]) =>
            Object.entries(t.selectedTokenSets)
              .filter(([s, state]) => state === "enabled" && ctx.system.sets.has(s))
              .flatMap(([s]) => tokensOf(ctx, s));
          const base = themes[0]!;
          const against: Record<string, unknown> = {};
          for (const other of themes.slice(1)) {
            const diff = compareStructure(tokensOfTheme(base), tokensOfTheme(other), base.name, other.name);
            against[other.name] = {
              identical: diff.identical,
              ...(diff.missingInA.length > 0 && { missingInBase: diff.missingInA }),
              ...(diff.missingInB.length > 0 && { missingInTheme: diff.missingInB }),
              ...(diff.typeMismatches.length > 0 && { typeMismatches: diff.typeMismatches }),
            };
          }
          parity = { axis: name, base: base.name, against };
        }
      }

      const out = {
        rules: loaded.source,
        summary: {
          errors: allViolations.filter((v) => v.severity === "error").length,
          warnings: allViolations.filter((v) => v.severity === "warning").length,
          info: allViolations.filter((v) => v.severity === "info").length,
          brokenReferences: brokenRefs.length,
        },
        byRule,
        brokenReferences: brokenRefs.length > 0 ? brokenRefs.slice(0, 20) : [],
        parity,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    }
  );
}
