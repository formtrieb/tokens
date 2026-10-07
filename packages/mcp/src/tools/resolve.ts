import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compositionFor, selectionFor } from "../composition.js";
import { resolveAndLoad, TOKENS_PATH_DESCRIPTION } from "../token-context.js";
import { chainStep, colorForm, display, formatArg } from "./present.js";
import { themeAxesArg, THEME_AXES_DESCRIPTION, resolveAxes } from "./theme-arg.js";

export function registerResolveTools(server: McpServer) {
  server.registerTool(
    "resolve_token",
    {
      description:
        "Resolve a single token dot-path for a given theme: finalValue as @formtrieb/tokens-render writes it, the typed value, the token's type, the full reference chain and any problems (unknown reference, cycle, …). For resolving many paths at once (e.g. all states of a variant), use resolve_batch.",
      inputSchema: {
        path: z.string().min(1).describe("Token dot-path (e.g. 'color.controls.brand.background.enabled')"),
        theme: themeAxesArg.optional().describe(THEME_AXES_DESCRIPTION),
        format: formatArg,
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ path, theme, format, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const { axes } = resolveAxes(theme, ctx.axisMap);
      const { dict, values } = compositionFor(ctx, selectionFor(ctx.system, axes));
      const entry = dict.byKey.get(path);
      const resolution = values.get(path);
      const out =
        entry && resolution
          ? {
              token: path,
              theme: axes,
              type: entry.type,
              finalValue: display(resolution, entry, colorForm(format)),
              value: resolution.value,
              chain: resolution.chain.map(chainStep),
              problems: resolution.problems.length > 0 ? resolution.problems : undefined,
            }
          : {
              token: path,
              theme: axes,
              finalValue: null,
              chain: [],
              problems: [{ kind: dict.groups.has(path) ? "group-reference" : "unknown-reference", path, reference: path }],
            };
      return { content: [{ type: "text" as const, text: JSON.stringify(out, null, 2) }] };
    }
  );

  server.registerTool(
    "resolve_batch",
    {
      description:
        "Resolve multiple token dot-paths in one call against the same theme. Useful for resolving all states of a control variant. Pass verbose:true to include each path's typed value and full reference chain (steps + applied colour modifiers) — useful for spotting alpha/lighten/darken modifiers that shape the final value. For a single path with full chain tracing, use resolve_token.",
      inputSchema: {
        paths: z.array(z.string().min(1)).min(1).describe("Array of token dot-paths to resolve"),
        theme: themeAxesArg.optional().describe(THEME_AXES_DESCRIPTION),
        verbose: z
          .boolean()
          .optional()
          .describe("When true, include each path's typed value and full reference chain (steps + modifiers) instead of just a step count."),
        format: formatArg,
        tokens_path: z.string().optional().describe(TOKENS_PATH_DESCRIPTION),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ paths, theme, verbose, format, tokens_path }) => {
      const ctx = resolveAndLoad({ tokens_path });
      const { axes } = resolveAxes(theme, ctx.axisMap);
      const { dict, values } = compositionFor(ctx, selectionFor(ctx.system, axes));
      const color = colorForm(format);
      const results: Record<string, unknown> = {};
      for (const path of paths) {
        const entry = dict.byKey.get(path);
        const resolution = values.get(path);
        if (!entry || !resolution) {
          results[path] = {
            finalValue: null,
            steps: 0,
            problems: [{ kind: dict.groups.has(path) ? "group-reference" : "unknown-reference", path, reference: path }],
          };
          continue;
        }
        results[path] = {
          finalValue: display(resolution, entry, color),
          type: entry.type,
          steps: resolution.chain.length,
          ...(verbose && { value: resolution.value, chain: resolution.chain.map(chainStep) }),
          problems: resolution.problems.length > 0 ? resolution.problems : undefined,
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ theme: axes, results }, null, 2) }] };
    }
  );
}
