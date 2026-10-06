import type { RenderFile, RenderFileOptions, RenderRule } from "./types.js";

const OPTIONS: Record<keyof RenderFileOptions, (value: unknown) => boolean> = {
  prefix: (v) => typeof v === "string",
  dialect: (v) => v === "style-dictionary" || v === "canonical",
  basePxFontSize: (v) => typeof v === "number" && v > 0,
  units: (v) => v === "rem" || v === "source",
  color: (v) => v === "rgb" || v === "source",
};

/**
 * Reads a render file (`render.json`, already parsed): either a bare list of
 * rules or `{ options?, rules }`. Returns both parts and throws, naming the
 * entry, when a rule or an option is malformed or an option is unknown.
 * `source` names the file in error messages.
 */
export function parseRenderFile(
  data: unknown,
  source = "render.json"
): { options: RenderFileOptions; rules: RenderRule[] } {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };
  const file = data as RenderFile;
  const rules: unknown = Array.isArray(file) ? file : file?.rules;
  const options: unknown = Array.isArray(file) ? {} : (file?.options ?? {});
  if (!Array.isArray(rules)) fail("expected a list of rules or { options?, rules }.");
  if (typeof options !== "object" || options === null || Array.isArray(options)) fail("options must be an object.");

  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    const valid = OPTIONS[key as keyof RenderFileOptions];
    if (!valid) fail(`options.${key} is not an output option (allowed: ${Object.keys(OPTIONS).join(", ")}).`);
    if (!valid(value)) fail(`options.${key} has an invalid value: ${JSON.stringify(value)}.`);
  }
  (rules as unknown[]).forEach((rule, i) => {
    const r = rule as Partial<RenderRule> | null;
    for (const key of ["theme", "selector", "file"] as const) {
      if (typeof r?.[key] !== "string" || !r[key]) fail(`rules[${i}].${key} must be a non-empty string.`);
    }
    if (typeof r!.references !== "boolean") fail(`rules[${i}].references must be true or false.`);
    if (r!.media !== undefined && typeof r!.media !== "string") fail(`rules[${i}].media must be a string.`);
  });
  return { options: options as RenderFileOptions, rules: rules as RenderRule[] };
}
