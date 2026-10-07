/**
 * `formtrieb-tokens check`: what is wrong with a token system, without
 * writing anything. The report comes from core's `designReport`, in the same
 * form the MCP server's `check_design_rules` returns; what fails is decided
 * here.
 */
import {
  atLeast,
  buildAxisMap,
  compose,
  composeTheme,
  designReport,
  resolveDictionary,
  type DesignReport,
  type DictionaryEntry,
  type Severity,
  type TokenSystem,
} from '@formtrieb/tokens-core';
import { readTokenSystem } from './load-system.js';
import { renderSource } from './pipeline.js';
import { loadRules } from './rules.js';
import type { Config } from './types.js';

export interface CheckOptions {
  /** A rules file instead of `tokens.rules.json` next to the token folder. */
  rules?: string;
  /** The axis whose themes are compared; default the first with several themes. */
  axis?: string;
  /** The least severe finding that fails the check. Default `error`. */
  severity?: Severity;
}

export type CheckResult = { rules: string } & DesignReport & { passed: boolean; threshold: Severity };

/** A mistake in how the check was called (exit code 2), not a finding. */
export class UsageError extends Error {}

/** Each set's tokens read on their own, as the rules and the reference check see them. */
function tokensBySet(system: TokenSystem): DictionaryEntry[] {
  return system.order.flatMap((set) => compose(system, [{ set, state: 'enabled' }]).entries);
}

export async function runCheck(config: Config, options: CheckOptions = {}): Promise<CheckResult> {
  const threshold = options.severity ?? 'error';
  const { system, problems: loadProblems } = readTokenSystem(config.paths.tokens);

  let loaded;
  try {
    loaded = loadRules(options.rules, config.paths.tokens);
  } catch (e) {
    throw new UsageError((e as Error).message);
  }

  // Parity over one axis: the tokens each of its themes enables.
  const axisMap = buildAxisMap(system.themes);
  if (options.axis !== undefined && !axisMap.has(options.axis)) {
    throw new UsageError(`Unknown theme axis "${options.axis}". Axes in this token system: ${[...axisMap.keys()].join(', ')}`);
  }
  const axis = options.axis ?? [...axisMap].find(([, themes]) => themes.length > 1)?.[0];
  const parity =
    axis === undefined
      ? undefined
      : {
          axis,
          themes: axisMap.get(axis)!.map((t) => ({
            name: t.name,
            entries: Object.entries(t.selectedTokenSets)
              .filter(([set, state]) => state === 'enabled' && system.sets.has(set))
              .flatMap(([set]) => compose(system, [{ set, state: 'enabled' }]).entries),
          })),
        };

  // Resolution of every theme the render table writes, each once.
  const { rules: table } = await renderSource(config, system);
  const themes = [...new Set(table.map((r) => r.theme))];
  const resolution = [
    ...(loadProblems.length > 0 ? [{ scope: '(loading)', problems: loadProblems }] : []),
    ...themes.map((id) => ({ scope: id, problems: resolveDictionary(composeTheme(system, id)).problems })),
  ];

  const report = designReport({
    entries: tokensBySet(system),
    rules: loaded.rules,
    severity: threshold === 'info' ? 'info' : 'warning',
    parity,
    resolution,
  });

  const failing =
    Object.values(report.byRule).some((r) => atLeast(r.severity, threshold)) ||
    report.resolution.problems.some((p) => atLeast(p.severity, threshold));
  return { rules: loaded.source, ...report, passed: !failing, threshold };
}

const MARK: Record<Severity, string> = { error: '✗', warning: '!', info: '·' };

function describe(p: CheckResult['resolution']['problems'][number]): string {
  switch (p.kind) {
    case 'unknown-reference':
    case 'group-reference':
      return `${p.path} → {${p.reference}}`;
    case 'cycle':
      return p.cycle.join(' → ');
    case 'untyped-token':
    case 'node-conflict':
      return `${p.path} (set ${p.set})`;
    case 'invalid-value':
      return `${p.path}: ${p.reason}`;
    case 'missing-set':
      return `set ${p.set} has no file`;
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The result as text, as the other CLI messages are written. */
export function formatCheck(result: CheckResult): string {
  const lines: string[] = [`Rules: ${result.rules}`, ''];

  lines.push(`Resolution — ${plural(result.resolution.themes.filter((t) => t !== '(loading)').length, 'theme')}`);
  if (result.resolution.problems.length === 0) lines.push('  none');
  const total = result.resolution.themes.length;
  const where = (themes: string[]) =>
    themes.length > 1 && themes.length === total ? `all ${total} themes` : themes.length > 3 ? `${themes.slice(0, 3).join(', ')} +${themes.length - 3}` : themes.join(', ');
  for (const p of result.resolution.problems) lines.push(`  ${MARK[p.severity]} ${p.kind.padEnd(18)} ${describe(p)}   (${where(p.themes)})`);

  lines.push('', 'Design rules');
  const rules = Object.entries(result.byRule);
  if (rules.length === 0) lines.push(result.rules === 'none' ? '  no rules file' : '  none');
  for (const [name, r] of rules) {
    lines.push(`  ${MARK[r.severity]} ${name}  ${r.severity} · ${r.count}`);
    lines.push(`      ${r.example.path}: ${r.example.actual}`);
    lines.push(`      (expected ${r.example.expected})${r.affected.length > 1 ? `  — also in ${r.affected.slice(1, 4).join(', ')}${r.affected.length > 4 ? ', …' : ''}` : ''}`);
  }

  lines.push('', `Broken references: ${result.summary.brokenReferences === 0 ? 'none' : result.summary.brokenReferences}`);
  for (const b of result.brokenReferences) lines.push(`  ${b.path} → {${b.missingRef}} (set ${b.sourceSet})`);

  if (result.parity === 'not checked') {
    lines.push('Parity: not checked');
  } else {
    const base = result.parity.base;
    const parts = Object.entries(result.parity.against).map(([name, d]) => {
      if (d.identical) return `${base} vs ${name} identical`;
      const missing = [d.missingInBase && `${d.missingInBase.length} only in ${name}`, d.missingInTheme && `${d.missingInTheme.length} missing in ${name}`, d.typeMismatches && `${d.typeMismatches.length} type mismatches`];
      return `${base} vs ${name}: ${missing.filter(Boolean).join(', ')}`;
    });
    lines.push(`Parity (axis ${result.parity.axis}): ${parts.join('; ')}`);
  }

  const { errors, warnings, info } = result.summary;
  const counts = [plural(errors, 'error'), plural(warnings, 'warning'), ...(info > 0 ? [plural(info, 'info')] : [])].join(', ');
  lines.push('', result.passed ? `✓ ${counts} — passed at threshold "${result.threshold}"` : `✗ ${counts} — failed at threshold "${result.threshold}"`);
  return lines.join('\n');
}
