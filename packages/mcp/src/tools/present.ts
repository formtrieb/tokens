/** How tools show resolved values: render's formatter, the chain in its established shape. */
import { z } from "zod";
import { formatTokenValue, type ColorForm } from "@formtrieb/tokens-render";
import type { ChainStep, DictionaryEntry, Resolution } from "@formtrieb/tokens-core";

export const formatArg = z
  .enum(["source", "rgb", "hex", "rgba"])
  .optional()
  .describe(
    "How colours are shown in finalValue, as @formtrieb/tokens-render writes them: 'source' (default; literals as written), 'rgb' (literals as rgb()/rgba()), 'hex' (every colour as #rrggbb, #rrggbbaa when translucent). Under 'source' and 'rgb' a colour a modifier computed is rgb(r% g% b% / a). 'rgba' is the same as 'rgb'. Lengths are shown as written."
  );

export function colorForm(format: "source" | "rgb" | "hex" | "rgba" | undefined): ColorForm {
  return format === "rgba" ? "rgb" : (format ?? "source");
}

/** The value as render writes it with units as written and the given colour form. */
export function display(resolution: Resolution, entry: DictionaryEntry, color: ColorForm): string {
  return formatTokenValue(resolution.value, { path: entry.path, type: entry.type }, { color }).text;
}

/** A chain step in the shape tools have always returned. */
export function chainStep(step: ChainStep) {
  return {
    tokenPath: step.key,
    rawValue: step.value,
    sourceSet: step.set,
    ...(step.modify && { modifier: step.modify }),
  };
}

/**
 * Reject a type filter the loaded system does not use. Token types differ
 * per design system and a tool schema is static, so the check runs here.
 */
export function assertType(type: string, entries: readonly DictionaryEntry[]): void {
  const known = [...new Set(entries.map((e) => e.type).filter((t): t is string => t !== undefined))].sort();
  if (known.includes(type)) return;
  const suggestion = known.find((t) => t.toLowerCase() === type.toLowerCase());
  throw new Error(
    `Unknown token type "${type}"${suggestion ? ` — did you mean "${suggestion}"?` : "."}\n` +
      `Types in this token system: ${known.join(", ")}`
  );
}

export const TYPE_DESCRIPTION =
  "Filter by the token's $type as the token system writes it (e.g. 'color', 'dimension', 'fontSizes'); a type inherited from a group counts. The types differ per design system; an unknown type is rejected with the list of types in use.";
