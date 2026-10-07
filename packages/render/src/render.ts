/**
 * The render functions. Each returns a map of output file → content; the
 * caller decides where the files go.
 */
import { composeTheme, resolveDictionary } from "@formtrieb/tokens-core";
import { FILE_HEADER, renderBlock, type Block } from "./css/variables.js";
import { unitPolicy } from "./css/units.js";
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

export function withDefaults(options: RenderOptions): ResolvedRenderOptions {
  return {
    prefix: options.prefix,
    units: unitPolicy(options.units),
    basePxFontSize: options.basePxFontSize ?? 16,
    color: options.color ?? "source",
    typographyCompanions: options.typographyCompanions ?? false,
    privateTokenPrefixes: options.privateTokenPrefixes ?? ["*"],
    typography: options.typography ?? {},
  };
}

/**
 * One file per distinct `rule.file`, blocks in rule order. Throws
 * {@link InvalidCssError} when any value is no valid CSS.
 */
export function renderVariables(
  system: TokenSystem,
  rules: readonly RenderRule[],
  renderOptions: RenderOptions
): RenderedFiles {
  const options = withDefaults(renderOptions);
  const blocks = new Map<string, Block[]>();
  const problems: InvalidCssError["problems"] = [];
  for (const rule of rules) {
    const theme = system.themes.find((t) => `${t.group}/${t.name}` === rule.theme);
    if (!theme) throw new Error(`render: no theme "${rule.theme}" in $themes.json`);
    const dict = composeTheme(system, theme);
    const block = renderBlock(dict, resolveDictionary(dict).values, rule, options);
    for (const p of block.invalid) problems.push({ theme: rule.theme, file: rule.file, ...p });
    const list = blocks.get(rule.file) ?? [];
    list.push(block);
    blocks.set(rule.file, list);
  }
  if (problems.length > 0) throw new InvalidCssError(problems);

  const files: RenderedFiles = new Map();
  for (const [file, list] of blocks) files.set(file, FILE_HEADER + list.map((b) => `${b.text}
`).join(""));
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
  const { typographyCompanions } = withDefaults(options);
  for (const builder of builders) {
    const out = await builder({ tokens, config, typographyCompanions });
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
