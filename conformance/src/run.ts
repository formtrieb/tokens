/**
 * Conformance run: every token of one token system through both machines.
 *
 *   pnpm conformance                       default fixture, compare with baseline
 *   pnpm conformance --update-baseline     pin the current state
 *   pnpm conformance --tokens <dir>        any Tokens-Studio export (no baseline check
 *                                          unless --baseline <file> is given)
 *   pnpm conformance --css                 whole resolver output vs render, file by
 *                                          file (src/css.ts); with --tokens <dir>
 *                                          also --config <resolver config>
 *
 * Exit 0 when the result equals the baseline (or no baseline applies),
 * 1 when findings appeared or disappeared. A disappeared finding is a change
 * too — it is pinned again deliberately, never silently.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, compareValues, display, type Category } from './compare.js';
import {
  loadTokenSystem,
  readWithCore,
  readWithStyleDictionary,
  themeId,
  type TokenSystem,
} from './machines.js';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DEFAULT_TOKENS = join(REPO_ROOT, 'packages/resolver/tests/fixtures/tokens');
export const DEFAULT_BASELINE = join(REPO_ROOT, 'conformance/baseline.json');
const DEFAULT_OUT = join(REPO_ROOT, 'conformance/out');
const DEFAULT_CONFIG = join(REPO_ROOT, 'packages/resolver/formtrieb-tokens.config.ts');
const DEFAULT_ALLOWLIST = join(REPO_ROOT, 'conformance/css-allowlist.json');

export interface Finding {
  theme: string;
  path: string;
  type?: string;
  category: Category;
  core: string;
  sd: string;
  detail?: string;
}

export type Counts = Record<Category, number>;

export interface Result {
  /** tokens directory, relative to the repo root when inside it */
  tokens: string;
  themes: Record<string, Counts>;
  totals: Counts;
  byType: Record<string, Counts>;
  /** every non-match reading except composites (those are counted only) */
  findings: Finding[];
}

function emptyCounts(): Counts {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Counts;
}

export async function runConformance(tokensDir: string): Promise<Result> {
  const system = loadTokenSystem(tokensDir);
  const result: Result = {
    tokens: portable(tokensDir),
    themes: {},
    totals: emptyCounts(),
    byType: {},
    findings: [],
  };

  for (const theme of system.themes) {
    const id = themeId(theme);
    const core = readWithCore(system, theme);
    const sd = await readWithStyleDictionary(system, theme);
    const counts = emptyCounts();

    const paths = new Set([...core.keys(), ...sd.keys()]);
    for (const path of [...paths].sort()) {
      const c = core.get(path);
      const s = sd.get(path);
      const type = c?.type ?? s?.type;
      let verdict = compareValues(type, c?.value, s?.value);
      if (c?.errors && verdict.category !== 'missing') {
        verdict = { category: 'unparseable', detail: `core: ${c.errors.join('; ')}` };
      }

      counts[verdict.category]++;
      result.totals[verdict.category]++;
      const typeKey = type ?? '(untyped)';
      result.byType[typeKey] ??= emptyCounts();
      result.byType[typeKey][verdict.category]++;

      if (verdict.category !== 'match' && verdict.category !== 'composite') {
        result.findings.push({
          theme: id,
          path,
          type,
          category: verdict.category,
          core: display(c?.value),
          sd: display(s?.value),
          ...(verdict.detail && { detail: verdict.detail }),
        });
      }
    }
    result.themes[id] = counts;
  }
  return result;
}

function portable(p: string): string {
  const rel = relative(REPO_ROOT, p);
  return rel.startsWith('..') || isAbsolute(rel) ? p : rel.split('\\').join('/');
}

// ── report ────────────────────────────────────────────────────────────────

export function renderReport(r: Result): string {
  const lines: string[] = [];
  lines.push(`# Conformance — tokens-core vs Style Dictionary resolver`, ``);
  lines.push(`Tokens: \`${r.tokens}\``, ``);

  const head = `| Theme | ${CATEGORIES.join(' | ')} |`;
  const sep = `|---|${CATEGORIES.map(() => '---:').join('|')}|`;
  lines.push(`## Per theme`, ``, head, sep);
  for (const [id, c] of Object.entries(r.themes)) {
    lines.push(`| ${id} | ${CATEGORIES.map((k) => c[k]).join(' | ')} |`);
  }
  lines.push(`| **total** | ${CATEGORIES.map((k) => `**${r.totals[k]}**`).join(' | ')} |`, ``);

  lines.push(`## Per type`, ``, `| $type | ${CATEGORIES.join(' | ')} |`, sep);
  for (const [t, c] of Object.entries(r.byType).sort()) {
    lines.push(`| ${t} | ${CATEGORIES.map((k) => c[k]).join(' | ')} |`);
  }
  lines.push(``);

  for (const cat of ['divergent', 'unparseable', 'missing', 'rounding'] as Category[]) {
    const items = r.findings.filter((f) => f.category === cat);
    if (items.length === 0) continue;
    lines.push(`## ${cat} (${items.length})`, ``);
    lines.push(`| Theme | Path | $type | core | sd | detail |`, `|---|---|---|---|---|---|`);
    for (const f of items) {
      lines.push(
        `| ${f.theme} | \`${f.path}\` | ${f.type ?? ''} | \`${f.core}\` | \`${f.sd}\` | ${f.detail ?? ''} |`
      );
    }
    lines.push(``);
  }
  if (r.totals.composite > 0) {
    lines.push(
      `## composite (${r.totals.composite})`,
      ``,
      `Object-valued tokens (typography, shadows, …) are counted but not compared yet.`,
      ``
    );
  }
  return lines.join('\n');
}

export function summarize(r: Result): string {
  const t = r.totals;
  const checked = t.match + t.rounding + t.divergent + t.unparseable + t.missing;
  return [
    `${Object.keys(r.themes).length} themes, ${checked} tokens compared, ${t.composite} composite tokens counted only`,
    `  match ${t.match} · rounding ${t.rounding} · divergent ${t.divergent} · unparseable ${t.unparseable} · missing ${t.missing}`,
  ].join('\n');
}

// ── baseline ──────────────────────────────────────────────────────────────

function findingKey(f: Finding): string {
  return `${f.theme} ${f.path} ${f.category} ${f.core} ${f.sd}`;
}

export function diffAgainstBaseline(
  current: Result,
  baseline: Result
): { appeared: Finding[]; disappeared: Finding[]; countsChanged: boolean } {
  const now = new Map(current.findings.map((f) => [findingKey(f), f]));
  const then = new Map(baseline.findings.map((f) => [findingKey(f), f]));
  const appeared = [...now].filter(([k]) => !then.has(k)).map(([, f]) => f);
  const disappeared = [...then].filter(([k]) => !now.has(k)).map(([, f]) => f);
  const countsChanged =
    JSON.stringify(current.themes) !== JSON.stringify(baseline.themes) ||
    JSON.stringify(current.totals) !== JSON.stringify(baseline.totals);
  return { appeared, disappeared, countsChanged };
}

// ── cli ───────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function mainCss() {
  const tokens = arg('--tokens');
  const config = arg('--config');
  if (tokens && !config) {
    console.error('--css with --tokens needs the resolver config of that system: --config <file>');
    process.exit(2);
  }
  // Loaded only here: the token mode and its baseline test never pull in render.
  const { runCssConformance, renderCssReport, cssSummary } = await import('./css.js');
  const outDir = resolve(arg('--out') ?? DEFAULT_OUT);
  const allow = JSON.parse(readFileSync(DEFAULT_ALLOWLIST, 'utf-8'));
  const run = await runCssConformance(
    resolve(tokens ?? DEFAULT_TOKENS),
    resolve(config ?? DEFAULT_CONFIG),
    allow,
    outDir
  );

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'css-report.md'), renderCssReport(run, REPO_ROOT));
  writeFileSync(join(outDir, 'css-result.json'), JSON.stringify(run, null, 2) + '\n');
  console.log(cssSummary(run));
  for (const f of run.files) {
    const note = f.status === 'missing' && f.error ? ` — ${f.error}` : '';
    console.log(`  ${f.status === 'identical' || f.status === 'allowed' ? '✓' : '✗'} ${f.file} [${f.status}]${note}`);
  }
  const shown = (p: string) => (relative(process.cwd(), p).startsWith('..') ? p : relative(process.cwd(), p));
  if (run.seeded.length) console.log(`seeded: ${run.seeded.join(', ')}`);
  console.log(`report: ${shown(join(outDir, 'css-report.md'))}`);
  console.log(`trees:  ${shown(join(outDir, 'css'))}/{sd,render}`);
  if (run.files.some((f) => f.status !== 'identical' && f.status !== 'allowed')) process.exitCode = 1;
}

async function main() {
  if (process.argv.includes('--css')) return mainCss();
  const tokensDir = resolve(arg('--tokens') ?? DEFAULT_TOKENS);
  const update = process.argv.includes('--update-baseline');
  const explicitBaseline = arg('--baseline');
  const baselinePath = explicitBaseline
    ? resolve(explicitBaseline)
    : tokensDir === DEFAULT_TOKENS
      ? DEFAULT_BASELINE
      : undefined;
  const outDir = resolve(arg('--out') ?? DEFAULT_OUT);

  const result = await runConformance(tokensDir);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.md'), renderReport(result));
  writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(summarize(result));
  console.log(`report: ${relative(process.cwd(), join(outDir, 'report.md'))}`);

  if (!baselinePath) return;

  if (update || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify(result, null, 2) + '\n');
    console.log(`baseline ${update ? 'updated' : 'created'}: ${relative(process.cwd(), baselinePath)}`);
    return;
  }

  const baseline: Result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  const { appeared, disappeared, countsChanged } = diffAgainstBaseline(result, baseline);
  if (appeared.length === 0 && disappeared.length === 0 && !countsChanged) {
    console.log('baseline: unchanged');
    return;
  }
  console.log(`baseline: ${appeared.length} finding(s) appeared, ${disappeared.length} disappeared${countsChanged ? ', counts changed' : ''}`);
  for (const f of appeared) console.log(`  + ${f.theme} ${f.path} [${f.category}] ${f.core} vs ${f.sd}`);
  for (const f of disappeared) console.log(`  - ${f.theme} ${f.path} [${f.category}] ${f.core} vs ${f.sd}`);
  console.log('run with --update-baseline to pin this state deliberately.');
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
