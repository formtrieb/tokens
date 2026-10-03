/**
 * `pnpm conformance --css`: the whole resolver output, written twice and
 * compared as text.
 *
 *   sd      today's resolver (`runPipeline`, Style Dictionary) into a temp dir
 *   render  `@formtrieb/tokens-render` with the render table derived from
 *           `$themes.json` and the same config
 *
 * File by file: identical, allowed (only deviations from css-allowlist.json),
 * diff, missing (render produced no such file, with the step's error) or
 * extra. Exit 1 while anything is red. The resolver's own output directory is
 * never touched; this mode only measures.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
// Internal modules of the resolver, driven exactly as its CLI drives them.
import { loadConfig } from '../../packages/resolver/src/build/load-config.js';
import { runPipeline } from '../../packages/resolver/src/pipeline.js';
import type { Config } from '../../packages/resolver/src/types.js';
// render from source, like the resolver above: no build step before a run.
import {
  deriveRenderTable,
  renderBundle,
  renderImports,
  renderTokenMap,
  renderUtilities,
  renderVariables,
  type RenderOptions,
  type UtilityBuilder,
} from '../../packages/render/src/index.js';
import { compareTrees, isGreen, type AllowRule, type FileVerdict } from './css-diff.js';
import { loadTokenSystem } from './machines.js';

/** Key the token map is compared under; the resolver writes it to `paths.tokenMap`. */
const TOKEN_MAP = 'token-map.json';
const DIFF_LINES = 20;

export interface CssRun {
  tokens: string;
  config: string;
  /** Hand-written files taken from the config's output dir (see readSeed). */
  seeded: string[];
  files: FileVerdict[];
}

function readTree(root: string, dir = root, out = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) readTree(root, full, out);
    else out.set(relative(root, full).split('\\').join('/'), readFileSync(full, 'utf-8'));
  }
  return out;
}

function writeTree(root: string, files: ReadonlyMap<string, string>): void {
  rmSync(root, { recursive: true, force: true });
  for (const [file, content] of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
}

/** The resolver talks while it builds; the instrument only wants its files. */
// SD's broken-reference report goes to console.error even when every value
// resolves in the end; a real failure still throws out of runPipeline.
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { log, info, warn, error } = console;
  console.log = console.info = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, { log, info, warn, error });
  }
}

// Same shape the resolver's bundler inlines: any quoted path, `./` or not.
const LOCAL_IMPORT = /^@import\s+['"]([^'"]+)['"];/;

/**
 * What a real output directory holds besides generated files: `main.css`
 * with hand-written lines, which the resolver keeps, and the local files
 * those lines import, which the bundle inlines. A build into an empty dir
 * would know neither, and the oracle would not be the consumer's output.
 * Seeded on both sides, never compared.
 */
export function readSeed(outputDir: string): Map<string, string> {
  const seed = new Map<string, string>();
  const main = join(outputDir, 'main.css');
  if (!existsSync(main)) return seed;
  const content = readFileSync(main, 'utf-8');
  seed.set('main.css', content);
  for (const line of content.split('\n')) {
    const file = LOCAL_IMPORT.exec(line.trim())?.[1].replace(/^\.\//, '');
    if (!file || file.startsWith('variables/') || file.startsWith('utilities/')) continue;
    if (existsSync(join(outputDir, file))) seed.set(file, readFileSync(join(outputDir, file), 'utf-8'));
  }
  return seed;
}

async function buildWithResolver(
  config: Config,
  tokensDir: string,
  seed: ReadonlyMap<string, string>
): Promise<Map<string, string>> {
  const tmp = mkdtempSync(join(tmpdir(), 'conformance-css-'));
  try {
    const output = join(tmp, 'css');
    const tokenMap = join(tmp, 'tokens', TOKEN_MAP);
    writeTree(output, seed);
    await quietly(() =>
      runPipeline({ ...config, paths: { tokens: tokensDir, output, tokenMap } })
    );
    const files = readTree(output);
    for (const file of seed.keys()) if (file !== 'main.css') files.delete(file);
    files.set(TOKEN_MAP, readFileSync(tokenMap, 'utf-8'));
    return files;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Which render step owes a resolver file — to say why it is missing. */
function stepFor(file: string): string {
  if (file.startsWith('variables/')) return 'variables';
  if (file.startsWith('utilities/')) return 'utilities';
  if (file === 'main.css') return 'imports';
  if (file === 'bundle.css') return 'bundle';
  if (file === TOKEN_MAP) return 'token-map';
  return '(no step)';
}

async function buildWithRender(
  config: Config,
  tokensDir: string,
  seed: ReadonlyMap<string, string>
): Promise<{ files: Map<string, string>; errorFor: (file: string) => string | undefined }> {
  const system = loadTokenSystem(tokensDir);
  const options: RenderOptions = {
    prefix: config.prefix,
    basePxFontSize: 16,
    privateTokenPrefixes: config.privateTokenPrefixes ?? ['*'],
    typography: config.typography ?? {},
  };
  const files = new Map<string, string>();
  const failed = new Map<string, string>();

  const step = async (name: string, run: () => Map<string, string> | Promise<Map<string, string>>) => {
    try {
      for (const [file, content] of await run()) files.set(file, content);
    } catch (err) {
      failed.set(name, err instanceof Error ? err.message : String(err));
    }
  };

  const rules = deriveRenderTable(system.themes, config);
  await step('variables', () => renderVariables(system, rules, options));
  // The resolver's builders still take `{ tokens, config }`; they move into
  // render with 3c (FOR-508). Until then render rejects them anyway.
  await step('utilities', () =>
    renderUtilities(system, (config.utilities ?? []) as unknown as UtilityBuilder[], options)
  );
  await step('imports', () => renderImports(files.keys(), seed.get('main.css')));
  await step('bundle', () => {
    const input = new Map(seed);
    for (const [file, content] of files) input.set(file, content);
    return renderBundle(input);
  });
  await step('token-map', () => renderTokenMap(system, options));

  return { files, errorFor: (file) => failed.get(stepFor(file)) };
}

export async function runCssConformance(
  tokensDir: string,
  configPath: string,
  allow: AllowRule[],
  outDir?: string
): Promise<CssRun> {
  const config = await loadConfig(configPath);
  const seed = config.paths.output ? readSeed(config.paths.output) : new Map<string, string>();
  const sd = await buildWithResolver(config, tokensDir, seed);
  const render = await buildWithRender(config, tokensDir, seed);
  if (outDir) {
    writeTree(join(outDir, 'css', 'sd'), sd);
    writeTree(join(outDir, 'css', 'render'), render.files);
  }
  return {
    tokens: tokensDir,
    config: configPath,
    seeded: [...seed.keys()],
    files: compareTrees(sd, render.files, allow, render.errorFor),
  };
}

// ── report ────────────────────────────────────────────────────────────────

export function cssSummary(run: CssRun): string {
  const red = run.files.filter((f) => !isGreen(f.status));
  const count = (s: string) => run.files.filter((f) => f.status === s).length;
  return [
    `${run.files.length} files, ${run.files.length - red.length} green, ${red.length} red`,
    `  identical ${count('identical')} · allowed ${count('allowed')} · diff ${count('diff')} · missing ${count('missing')} · extra ${count('extra')}`,
  ].join('\n');
}

function shown(p: string, base: string): string {
  const rel = relative(base, p);
  return rel.startsWith('..') ? p : rel || '.';
}

export function renderCssReport(run: CssRun, base = process.cwd()): string {
  const lines = [
    `# Conformance --css — render vs Style Dictionary resolver`,
    ``,
    `Tokens: \`${shown(run.tokens, base)}\` · Config: \`${shown(run.config, base)}\``,
    ``,
    ...(run.seeded.length ? [`Seeded from the config's output dir: ${run.seeded.map((f) => `\`${f}\``).join(', ')}`, ``] : []),
    cssSummary(run).replace('\n  ', '\n\n'),
    ``,
    `| File | Status | Note |`,
    `|---|---|---|`,
  ];
  for (const f of run.files) {
    const note =
      f.status === 'missing'
        ? (f.error ?? '')
        : f.hunks
          ? `${f.hunks.length} hunk(s)${f.status === 'allowed' ? `: ${[...new Set(f.hunks.map((h) => h.allowed))].join(', ')}` : ''}`
          : '';
    lines.push(`| \`${f.file}\` | ${isGreen(f.status) ? '' : '✗ '}${f.status} | ${note} |`);
  }
  lines.push(``);

  for (const f of run.files.filter((f) => f.status === 'diff')) {
    lines.push(`## ${f.file}`, ``, '```diff');
    const out: string[] = [];
    for (const h of f.hunks ?? []) {
      if (h.allowed) continue;
      out.push(`@@ line ${h.at} @@`, ...h.sd.map((l) => `- ${l}`), ...h.render.map((l) => `+ ${l}`));
    }
    lines.push(...out.slice(0, DIFF_LINES));
    if (out.length > DIFF_LINES) lines.push(`… ${out.length - DIFF_LINES} more lines`);
    lines.push('```', ``);
  }
  return lines.join('\n');
}
