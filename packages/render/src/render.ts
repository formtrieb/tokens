/**
 * The render functions. Each returns a map of output file → content; the
 * caller decides where the files go. Signatures are fixed, bodies arrive step
 * by step (FOR-499): variables since 3b, the rest in 3c. Until then those
 * throw, and the conformance run's `--css` mode shows their files red.
 */
import { buildDictionary, findTheme } from "./css/dictionary.js";
import { finishValues } from "./css/values.js";
import { FILE_HEADER, renderBlock, type Block } from "./css/variables.js";
import type {
  RenderedFiles,
  RenderOptions,
  RenderRule,
  TokenSystem,
  UtilityBuilder,
} from "./types.js";

export class NotRenderedYet extends Error {
  constructor(fn: string, step: string) {
    super(`${fn} is not implemented yet (${step})`);
    this.name = "NotRenderedYet";
  }
}

/**
 * One file per distinct `rule.file`, blocks in rule order. A file with one
 * block keeps the resolver's quirk of no final newline after typography
 * companions.
 */
export function renderVariables(
  system: TokenSystem,
  rules: readonly RenderRule[],
  options: RenderOptions
): RenderedFiles {
  const blocks = new Map<string, Block[]>();
  for (const rule of rules) {
    const dict = buildDictionary(system, findTheme(system, rule.theme));
    const values = finishValues(dict, options.basePxFontSize);
    const list = blocks.get(rule.file) ?? [];
    list.push(renderBlock(dict, values, rule, options));
    blocks.set(rule.file, list);
  }

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

/** One file per builder, under `utilities/`. */
export async function renderUtilities(
  system: TokenSystem,
  builders: readonly UtilityBuilder[],
  options: RenderOptions
): Promise<RenderedFiles> {
  throw new NotRenderedYet("renderUtilities", "3c, FOR-508");
}

/**
 * `main.css`: `@import` for every `variables/*.css` and `utilities/*.css` in
 * `files`. Lines of `existing` that are not generated imports are kept on top.
 */
export function renderImports(files: Iterable<string>, existing?: string): RenderedFiles {
  throw new NotRenderedYet("renderImports", "3c, FOR-508");
}

/** `bundle.css`: `main.css` with every local `@import` inlined from `files`. */
export function renderBundle(files: ReadonlyMap<string, string>): RenderedFiles {
  throw new NotRenderedYet("renderBundle", "3c, FOR-508");
}

/** `token-map.json`: Figma path ↔ CSS variable lookup. */
export function renderTokenMap(system: TokenSystem, options: RenderOptions): RenderedFiles {
  throw new NotRenderedYet("renderTokenMap", "3c, FOR-508");
}
