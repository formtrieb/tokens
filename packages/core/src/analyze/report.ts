/**
 * One report of a token system's checks, in the form every adapter shows:
 * design rules grouped by rule, references to nothing, parity of the themes
 * of one axis, and the problems the resolution found. Pure: the adapters
 * read the files and decide what fails.
 */
import { checkRules, type DesignRules, type Severity } from "./rules.js";
import { compareStructure, findBrokenReferences } from "./validation.js";
import type { DictionaryEntry, TokenProblem } from "../system/types.js";

/** How serious a problem of the resolution is. */
export const RESOLUTION_SEVERITY: Record<TokenProblem["kind"], Severity> = {
  "unknown-reference": "error",
  "group-reference": "error",
  cycle: "error",
  "missing-set": "error",
  "invalid-value": "error",
  "untyped-token": "warning",
  "node-conflict": "warning",
};

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Whether a severity is at least as serious as a threshold. */
export const atLeast = (severity: Severity, threshold: Severity) => RANK[severity] <= RANK[threshold];

export interface ReportInput {
  /** The tokens the rules and the reference check look at (each set read on its own). */
  entries: readonly DictionaryEntry[];
  rules?: DesignRules;
  /** Findings below this severity are left out. Default `warning`. */
  severity?: Severity;
  /** Themes of one axis, the first the base the others are compared with. */
  parity?: { axis: string; themes: { name: string; entries: readonly DictionaryEntry[] }[] };
  /** Problems of resolving, per scope: a theme, or an axis selection. */
  resolution?: { scope: string; problems: readonly TokenProblem[] }[];
}

/** A problem of resolving, once, with every scope (theme or axis selection) it appears in. */
export type ResolutionFinding = TokenProblem & { themes: string[]; severity: Severity };

export interface DesignReport {
  /**
   * Rule and resolution findings counted together. `brokenReferences` is
   * not part of `errors`: a reference to nothing also shows as
   * `unknown-reference` in the resolution.
   */
  summary: { errors: number; warnings: number; info: number; brokenReferences: number; resolution: number };
  byRule: Record<string, { count: number; severity: Severity; affected: string[]; example: { path: string; expected: string; actual: string } }>;
  brokenReferences: ReturnType<typeof findBrokenReferences>;
  parity:
    | "not checked"
    | {
        axis: string;
        base: string;
        against: Record<string, { identical: boolean; missingInBase?: string[]; missingInTheme?: string[]; typeMismatches?: { path: string; typeA: string; typeB: string }[] }>;
      };
  resolution: { themes: string[]; problems: ResolutionFinding[] };
}

export function designReport(input: ReportInput): DesignReport {
  const threshold = input.severity ?? "warning";
  const entries = [...input.entries];

  const violations = (input.rules ? checkRules(entries, input.rules) : []).filter((v) => atLeast(v.severity, threshold));
  const byRule: DesignReport["byRule"] = {};
  for (const v of violations) {
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

  // A problem in a source set shows in every theme that reads the set: one finding, its themes listed.
  const resolution: DesignReport["resolution"] = { themes: [], problems: [] };
  const findings = new Map<string, ResolutionFinding>();
  for (const { scope, problems } of input.resolution ?? []) {
    resolution.themes.push(scope);
    for (const p of problems) {
      const severity = RESOLUTION_SEVERITY[p.kind];
      if (!atLeast(severity, threshold)) continue;
      const key = JSON.stringify(p);
      const found = findings.get(key);
      if (!found) findings.set(key, { themes: [scope], severity, ...p });
      else if (!found.themes.includes(scope)) found.themes.push(scope);
    }
  }
  resolution.problems = [...findings.values()];

  let parity: DesignReport["parity"] = "not checked";
  const themes = input.parity?.themes ?? [];
  if (input.parity && themes.length > 1) {
    const base = themes[0]!;
    const against: Exclude<DesignReport["parity"], "not checked">["against"] = {};
    for (const other of themes.slice(1)) {
      const diff = compareStructure([...base.entries], [...other.entries], base.name, other.name);
      against[other.name] = {
        identical: diff.identical,
        ...(diff.missingInA.length > 0 && { missingInBase: diff.missingInA }),
        ...(diff.missingInB.length > 0 && { missingInTheme: diff.missingInB }),
        ...(diff.typeMismatches.length > 0 && { typeMismatches: diff.typeMismatches }),
      };
    }
    parity = { axis: input.parity.axis, base: base.name, against };
  }

  const brokenReferences = findBrokenReferences(entries, new Set(entries.map((e) => e.key)));
  const count = (s: Severity) => violations.filter((v) => v.severity === s).length + resolution.problems.filter((p) => p.severity === s).length;
  return {
    summary: {
      errors: count("error"),
      warnings: count("warning"),
      info: count("info"),
      brokenReferences: brokenReferences.length,
      resolution: resolution.problems.length,
    },
    byRule,
    brokenReferences: brokenReferences.slice(0, 20),
    parity,
    resolution,
  };
}
