import { UNIT_PRESETS, UNIT_TARGETS } from "./css/units.js";
import type { RenderFile, RenderFileOptions, RenderRule } from "./types.js";

type Fail = (msg: string) => never;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function checkTarget(value: unknown, field: string, fail: Fail): void {
  if (!UNIT_TARGETS.includes(value as never)) {
    fail(`${field} must be one of ${UNIT_TARGETS.map((t) => `"${t}"`).join(", ")}, not ${JSON.stringify(value)}.`);
  }
}

/** A unit policy: a preset name, or `{ types?, paths? }`. */
function checkUnits(units: unknown, fail: Fail): void {
  if (typeof units === "string") {
    if (!Object.hasOwn(UNIT_PRESETS, units)) {
      fail(`options.units: unknown preset ${JSON.stringify(units)} (presets: ${Object.keys(UNIT_PRESETS).map((p) => `"${p}"`).join(", ")}).`);
    }
    return;
  }
  if (!isObject(units)) fail("options.units must be a preset name or { types?, paths? }.");
  const policy = units as Record<string, unknown>;
  for (const key of Object.keys(policy)) if (key !== "types" && key !== "paths") fail(`options.units.${key} is not part of a unit policy (allowed: types, paths).`);
  if (policy.types !== undefined) {
    if (!isObject(policy.types)) fail("options.units.types must map a type to a unit.");
    for (const [type, unit] of Object.entries(policy.types as Record<string, unknown>)) checkTarget(unit, `options.units.types.${type}`, fail);
  }
  if (policy.paths !== undefined) {
    if (!Array.isArray(policy.paths)) fail("options.units.paths must be a list of { match, unit }.");
    (policy.paths as unknown[]).forEach((rule, i) => {
      const r = rule as Record<string, unknown> | null;
      const match = r?.match;
      if (typeof match !== "string" || match === "" || match.split(".").some((s) => s === "")) {
        fail(`options.units.paths[${i}].match must be a dot path with no empty segment, e.g. "breakpoints.*".`);
      }
      checkTarget(r!.unit, `options.units.paths[${i}].unit`, fail);
    });
  }
}

const OPTIONS: Record<keyof RenderFileOptions, (value: unknown, fail: Fail) => void> = {
  prefix: (v, fail) => {
    if (typeof v !== "string") fail("options.prefix must be a string.");
  },
  units: checkUnits,
  basePxFontSize: (v, fail) => {
    if (!(typeof v === "number" && v > 0)) fail("options.basePxFontSize must be a positive number.");
  },
  color: (v, fail) => {
    if (v !== "source" && v !== "rgb" && v !== "hex") fail(`options.color must be "source", "rgb" or "hex", not ${JSON.stringify(v)}.`);
  },
  typographyCompanions: (v, fail) => {
    if (typeof v !== "boolean") fail("options.typographyCompanions must be true or false.");
  },
};

/**
 * Reads a render file (`render.json`, already parsed): either a bare list of
 * rules or `{ options?, rules }`. Returns both parts and throws, naming the
 * entry, when a rule or an option is malformed or an option is unknown.
 * `source` names the file in error messages.
 *
 * `options.units` is a preset name (`"source"`, `"tokens-studio"`) or
 * `{ types?, paths? }`: `types` maps a Tokens Studio type to `"rem"`, `"px"`
 * or `"source"`; each of `paths` is `{ match, unit }`, where `match` is a dot
 * path in source casing (`zIndex.base`), `*` one segment, `**` zero or more.
 *
 * An older file's `dialect: "canonical"` is accepted and has no effect (it
 * is what the defaults write); `"style-dictionary"` is refused.
 */
export function parseRenderFile(
  data: unknown,
  source = "render.json"
): { options: RenderFileOptions; rules: RenderRule[] } {
  const fail: Fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };
  const file = data as RenderFile;
  const rules: unknown = Array.isArray(file) ? file : file?.rules;
  const options: unknown = Array.isArray(file) ? {} : (file?.options ?? {});
  if (!Array.isArray(rules)) fail("expected a list of rules or { options?, rules }.");
  if (!isObject(options)) fail("options must be an object.");

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (key === "dialect") {
      if (value === "canonical") continue;
      if (value === "style-dictionary") {
        fail(
          'options.dialect "style-dictionary" no longer exists. Write what it wrote with ' +
            '"units": "tokens-studio", "color": "rgb", "typographyCompanions": true.'
        );
      }
      fail(`options.dialect has an invalid value: ${JSON.stringify(value)}.`);
    }
    const check = OPTIONS[key as keyof RenderFileOptions];
    if (!check) fail(`options.${key} is not an output option (allowed: ${Object.keys(OPTIONS).join(", ")}).`);
    check(value, fail);
    out[key] = value;
  }
  (rules as unknown[]).forEach((rule, i) => {
    const r = rule as Partial<RenderRule> | null;
    for (const key of ["theme", "selector", "file"] as const) {
      if (typeof r?.[key] !== "string" || !r[key]) fail(`rules[${i}].${key} must be a non-empty string.`);
    }
    if (typeof r!.references !== "boolean") fail(`rules[${i}].references must be true or false.`);
    if (r!.media !== undefined && typeof r!.media !== "string") fail(`rules[${i}].media must be a string.`);
  });
  return { options: out as RenderFileOptions, rules: rules as RenderRule[] };
}
