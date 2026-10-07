/**
 * Design rules as data. A rules file names which tokens a rule looks at and
 * what it expects of them; nothing here knows a path, set or segment of any
 * design system. Patterns are dot paths (`color.button.*.text`) and set
 * names (`Components/**`): `*` is one segment, `**` zero or more.
 */
import { referencesIn } from "../system/resolve.js";
import { matchPath } from "../system/match-path.js";
import type { DictionaryEntry } from "../system/types.js";
import type { DesignRuleViolation } from "../types.js";

export type Severity = "error" | "warning" | "info";

interface Scope {
  /** Report name; may repeat across rules. */
  rule: string;
  /** Token path patterns a token must match (any); all tokens when absent. */
  tokens?: string[];
  /** Set name patterns the token's set must match (any); all sets when absent. */
  sets?: string[];
  /** Default `warning`. */
  severity?: Severity;
  /** Text for `expected` in the report, instead of the generated one. */
  expected?: string;
}

export type DesignRule =
  /** Each reference in the value: inside `within` (when given), it must match `allow` (when given) and none of `deny`. */
  | (Scope & { kind: "references"; within?: string[]; allow?: string[]; deny?: string[] })
  /** At each position `index`, the path segment is one of `values`. */
  | (Scope & { kind: "segments"; segments: { index: number; name?: string; values: string[] }[] })
  /** At most `max` path segments. */
  | (Scope & { kind: "depth"; max: number })
  /** No reference to a sibling: same parent path, same depth. */
  | (Scope & { kind: "sibling-reference" });

export interface DesignRules {
  rules: DesignRule[];
}

const KINDS = ["references", "segments", "depth", "sibling-reference"] as const;
const SEVERITIES: Severity[] = ["error", "warning", "info"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A rules file (already parsed), checked: throws naming the field when a
 * rule is malformed. `source` names the file in error messages.
 */
export function parseRules(data: unknown, source = "rules"): DesignRules {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };
  if (!isObject(data) || !Array.isArray(data.rules)) fail("expected { rules: [...] }.");
  const patterns = (v: unknown, field: string) => {
    if (v === undefined) return;
    if (!Array.isArray(v) || v.some((p) => typeof p !== "string" || p === "" || p.split(/[./]/).some((s) => s === ""))) {
      fail(`${field} must be a list of patterns with no empty segment.`);
    }
  };
  ((data as { rules: unknown[] }).rules).forEach((raw, i) => {
    const at = `rules[${i}]`;
    if (!isObject(raw)) fail(`${at} must be an object.`);
    const r = raw as Record<string, unknown>;
    if (typeof r.rule !== "string" || r.rule === "") fail(`${at}.rule must be a non-empty string.`);
    if (!KINDS.includes(r.kind as never)) fail(`${at}.kind must be one of ${KINDS.map((k) => `"${k}"`).join(", ")}.`);
    if (r.severity !== undefined && !SEVERITIES.includes(r.severity as Severity)) fail(`${at}.severity must be "error", "warning" or "info".`);
    if (r.expected !== undefined && typeof r.expected !== "string") fail(`${at}.expected must be a string.`);
    for (const field of ["tokens", "sets", "within", "allow", "deny"]) patterns(r[field], `${at}.${field}`);
    if (r.kind === "segments") {
      if (!Array.isArray(r.segments) || r.segments.length === 0) fail(`${at}.segments must be a non-empty list.`);
      (r.segments as unknown[]).forEach((s, j) => {
        const seg = s as Record<string, unknown>;
        if (!isObject(s) || !Number.isInteger(seg.index) || (seg.index as number) < 0) fail(`${at}.segments[${j}].index must be a whole number ≥ 0.`);
        if (!Array.isArray(seg.values) || seg.values.some((v) => typeof v !== "string")) fail(`${at}.segments[${j}].values must be a list of strings.`);
      });
    }
    if (r.kind === "depth" && !(Number.isInteger(r.max) && (r.max as number) > 0)) fail(`${at}.max must be a whole number > 0.`);
  });
  return data as unknown as DesignRules;
}

const split = (pattern: string, sep: string) => pattern.split(sep);
const anyOf = (patterns: string[] | undefined, path: string[], sep: string) =>
  patterns?.some((p) => matchPath(split(p, sep), path)) ?? false;

/** Every violation of the rules among the tokens. */
export function checkRules(entries: readonly DictionaryEntry[], rules: DesignRules): DesignRuleViolation[] {
  const out: DesignRuleViolation[] = [];
  for (const rule of rules.rules) {
    const severity = rule.severity ?? "warning";
    const report = (path: string, expected: string, actual: string) =>
      out.push({ rule: rule.rule, path, expected: rule.expected ?? expected, actual, severity });
    for (const entry of entries) {
      if (rule.tokens && !anyOf(rule.tokens, entry.path, ".")) continue;
      if (rule.sets && !anyOf(rule.sets, entry.set.split("/"), "/")) continue;
      switch (rule.kind) {
        case "references":
          for (const ref of referencesIn(entry.value)) {
            const parts = ref.split(".");
            if (rule.within && !anyOf(rule.within, parts, ".")) continue;
            if (rule.allow && !anyOf(rule.allow, parts, ".")) report(entry.key, `Reference to ${rule.allow.join(" or ")}`, `References ${ref}`);
            else if (anyOf(rule.deny, parts, ".")) report(entry.key, `No reference to ${rule.deny!.join(" or ")}`, `References ${ref} directly`);
          }
          break;
        case "segments":
          for (const s of rule.segments) {
            const segment = entry.path[s.index];
            if (segment === undefined || s.values.includes(segment)) continue;
            report(entry.key, `Standard ${s.name ?? `segment ${s.index}`}: ${s.values.join(", ")}`, `Uses "${segment}"`);
          }
          break;
        case "depth":
          if (entry.path.length > rule.max) report(entry.key, `Token path with ${rule.max} or fewer segments`, `${entry.path.length} segments`);
          break;
        case "sibling-reference": {
          const parent = entry.path.slice(0, -1).join(".");
          for (const ref of referencesIn(entry.value)) {
            const parts = ref.split(".");
            if (parts.length === entry.path.length && parts.slice(0, -1).join(".") === parent) {
              report(entry.key, "Reference to a different level or group", `References sibling ${ref}`);
            }
          }
          break;
        }
      }
    }
  }
  return out;
}
