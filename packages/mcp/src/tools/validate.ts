import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  findPlaceholders,
  findBrokenReferences,
  compareStructure,
  checkControlsInteractionMapping,
  checkComponentReferences,
  checkNamingConventions,
} from "@formtrieb/tokens-core";
import { asRawToken, tokensOf } from "../composition.js";
import { resolveAndLoad, TOKENS_PATH_DESCRIPTION } from "../token-context.js";

export function registerValidateTools(server: McpServer) {
  server.registerTool(
    "find_placeholders",
    {
      description:
        "Find all placeholder tokens (#f305b7 magenta or #ff00ff) that mark undefined states needing real values. Use to audit token completeness.",
      inputSchema: {
        set: z
          .string()
          .optional()
          .describe(
            "Limit to a specific set (e.g. 'Semantic/Light') or layer (e.g. 'Semantic'). Omit to scan all sets."
          ),
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ set, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const tokens = tokensOf(ctx, set).map(asRawToken);
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
        "Check tokens against Formtrieb design system rules: controls-interaction category mapping, component reference patterns, broken references, naming conventions, and Light/Dark structural parity. Reports violations grouped by rule.",
      inputSchema: {
        set: z
          .string()
          .optional()
          .describe("Limit to a specific set or layer. Omit for system-wide check."),
        severity: z
          .enum(["error", "warning", "info"])
          .default("warning")
          .describe(
            "Minimum severity level to report. 'error' shows only errors, 'info' shows everything."
          ),
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ set, severity, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const tokens = tokensOf(ctx, set).map(asRawToken);
      const allPaths = new Set(tokens.map((t) => t.dotPath));

      const controlsViolations = checkControlsInteractionMapping(tokens);
      const componentViolations = checkComponentReferences(tokens);
      const namingViolations = checkNamingConventions(tokens);
      const brokenRefs = findBrokenReferences(tokens, allPaths);

      let structuralDiff = null;
      if (!set) {
        const lightTokens = ctx.system.sets.has("Semantic/Light") ? tokensOf(ctx, "Semantic/Light").map(asRawToken) : [];
        const darkTokens = ctx.system.sets.has("Semantic/Dark") ? tokensOf(ctx, "Semantic/Dark").map(asRawToken) : [];
        if (lightTokens.length > 0 && darkTokens.length > 0) {
          structuralDiff = compareStructure(
            lightTokens,
            darkTokens,
            "Light",
            "Dark"
          );
        }
      }

      const severityOrder = { error: 0, warning: 1, info: 2 };
      const minLevel = severityOrder[severity];
      const allViolations = [...controlsViolations, ...componentViolations, ...namingViolations]
        .filter((v) => severityOrder[v.severity] <= minLevel);

      // Group violations by rule for compact output
      const byRule: Record<string, {
        count: number;
        severity: string;
        affected: string[];
        example: { path: string; expected: string; actual: string };
      }> = {};

      for (const v of allViolations) {
        if (!byRule[v.rule]) {
          byRule[v.rule] = {
            count: 0,
            severity: v.severity,
            affected: [],
            example: { path: v.path, expected: v.expected, actual: v.actual },
          };
        }
        byRule[v.rule].count++;
        // Extract hierarchy/component segment for "affected" list
        const segments = v.path.split(".");
        const affected = segments[2] ?? segments[0];
        if (!byRule[v.rule].affected.includes(affected)) {
          byRule[v.rule].affected.push(affected);
        }
      }

      // Compact Light/Dark parity
      const lightDarkParity = structuralDiff
        ? {
            identical: structuralDiff.identical,
            ...(structuralDiff.missingInA.length > 0 && { missingInLight: structuralDiff.missingInA.length }),
            ...(structuralDiff.missingInB.length > 0 && {
              missingInDark: structuralDiff.missingInB.length,
              missingInDarkPaths: structuralDiff.missingInB,
            }),
            ...(structuralDiff.typeMismatches.length > 0 && { typeMismatches: structuralDiff.typeMismatches.length }),
          }
        : "not checked";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                summary: {
                  errors: allViolations.filter((v) => v.severity === "error").length,
                  warnings: allViolations.filter((v) => v.severity === "warning").length,
                  info: allViolations.filter((v) => v.severity === "info").length,
                  brokenReferences: brokenRefs.length,
                },
                byRule,
                brokenReferences: brokenRefs.length > 0 ? brokenRefs.slice(0, 20) : [],
                lightDarkParity,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
