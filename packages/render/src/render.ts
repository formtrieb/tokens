/**
 * The render functions. Each returns a map of output file → content; the
 * caller decides where the files go.
 */
import { buildDictionary, findTheme } from "./css/dictionary.js";
import { finishValues } from "./css/values.js";
import type { Presentation } from "./css/transforms.js";
import { FILE_HEADER, renderBlock, type Block } from "./css/variables.js";
import { builderTokens } from "./builders/tokens.js";
import { bundleCss } from "./bundle.js";
import { mainCss } from "./imports.js";
import { tokenMap } from "./token-map.js";
import type {
  RenderedFiles,
  RenderOptions,
  ResolvedRenderOptions,
  RenderRule,
  TokenSystem,
  BuilderConfig,
  BuilderFn,
} from "./types.js";

/** Values that are no valid CSS, each with token path, theme and file. Nothing is written. */
export class InvalidCssError extends Error {
  constructor(readonly problems: { theme: string; file: string; path: string; value: string; reason: string }[]) {
    super(
      `${problems.length} value(s) are no valid CSS:\n` +
        problems.map((p) => `  ${p.path} (theme ${p.theme}, ${p.file}): ${p.reason} — ${p.value}`).join("\n")
    );
    this.name = "InvalidCssError";
  }
}

function withDefaults(options: RenderOptions): ResolvedRenderOptions {
  const dialect = options.dialect ?? "style-dictionary";
  const canonical = dialect === "canonical";
  return {
    prefix: options.prefix,
    dialect,
    basePxFontSize: options.basePxFontSize ?? 16,
    units: options.units ?? (canonical ? "source" : "rem"),
    color: options.color ?? (canonical ? "source" : "rgb"),
    privateTokenPrefixes: options.privateTokenPrefixes ?? ["*"],
    typography: options.typography ?? {},
  };
}

/**
 * One file per distinct `rule.file`, blocks in rule order. A file with one
 * block keeps the resolver's quirk of no final newline after typography
 * companions. Throws {@link InvalidCssError} when any value is no valid CSS.
 */
export function renderVariables(
  system: TokenSystem,
  rules: readonly RenderRule[],
  renderOptions: RenderOptions
): RenderedFiles {
  const options = withDefaults(renderOptions);
  const blocks = new Map<string, Block[]>();
  const problems: InvalidCssError["problems"] = [];
  const presentation: Presentation = {
    basePxFontSize: options.basePxFontSize,
    units: options.units,
    color: options.color,
    dialect: options.dialect,
  };
  for (const rule of rules) {
    const dict = buildDictionary(system, findTheme(system, rule.theme));
    const values = finishValues(dict, presentation);
    const block = renderBlock(dict, values, rule, options, presentation);
    for (const p of block.invalid) problems.push({ theme: rule.theme, file: rule.file, ...p });
    const list = blocks.get(rule.file) ?? [];
    list.push(block);
    blocks.set(rule.file, list);
  }
  if (problems.length > 0) throw new InvalidCssError(problems);

  const files: RenderedFiles = new Map();
  for (const [file, list] of blocks) {
    if (list.length === 1) {
      files.set(file, FILE_HEADER + list[0].text + (list[0].expanded ? "" : "\n"));
    } else {
      files.set(file, (FILE_HEADER + list.map((b) => `${b.text}\n`).join("")).trim() + "\n");
    }
  }
  return files;
}

/**
 * One file per builder, under `utilities/`. Builders get every token of the
 * system and `config` — the resolver passes its whole config, so custom
 * builders keep reading what they always read.
 */
export async function renderUtilities<C extends BuilderConfig = BuilderConfig>(
  system: TokenSystem,
  builders: readonly BuilderFn<C>[],
  options: RenderOptions,
  config: C = { prefix: options.prefix } as C
): Promise<RenderedFiles> {
  const files: RenderedFiles = new Map();
  if (builders.length === 0) return files;
  const tokens = builderTokens(system.sets, system.order);
  const { dialect } = withDefaults(options);
  for (const builder of builders) {
    const out = await builder({ tokens, config, dialect });
    const file = `utilities/${out.filename}`;
    if (files.has(file)) {
      throw new Error(
        `Duplicate utility filename: ${out.filename} — two builders produced the same file. Rename one.`
      );
    }
    files.set(file, out.content);
  }
  return files;
}

/**
 * `main.css`: `@import` for every `variables/*.css` and `utilities/*.css` in
 * `files`. Lines of `existing` that are not generated imports are kept on top.
 */
export function renderImports(files: Iterable<string>, existing?: string): RenderedFiles {
  return new Map([["main.css", mainCss(files, existing)]]);
}

/** `bundle.css`: `main.css` with every local `@import` inlined from `files`. */
export function renderBundle(files: ReadonlyMap<string, string>): RenderedFiles {
  return new Map([["bundle.css", bundleCss(files)]]);
}

/** `token-map.json`: Figma path ↔ CSS variable lookup. */
export function renderTokenMap(system: TokenSystem, options: RenderOptions): RenderedFiles {
  return new Map([["token-map.json", tokenMap(system, withDefaults(options))]]);
}
