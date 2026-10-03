import type { ThemeDefinition } from "@formtrieb/tokens-core";

/**
 * A token system as read from a Tokens-Studio export, already in memory.
 * Reading it from disk is the caller's job; render never touches a file.
 */
export interface TokenSystem {
  /** Set names in `$metadata.json` order — the order sets override each other. */
  order: string[];
  /** Set name → parsed JSON of that set. */
  sets: ReadonlyMap<string, Record<string, unknown>>;
  /** `$themes.json`, parsed with core's `parseThemes`. */
  themes: ThemeDefinition[];
}

/**
 * One line of the render table: which theme is written where, under which
 * selector.
 *
 * The unit is the theme (a composition of enabled and source sets), never a
 * single set. The selector is the app's decision how it switches themes, so
 * the table lives with the consumer; {@link deriveRenderTable} derives the
 * default from `$themes.json`.
 */
export interface RenderRule {
  /** Theme id, `{group}/{name}` as in `$themes.json`. */
  theme: string;
  /** CSS selector the theme's variables are written under, e.g. `:root`. */
  selector: string;
  /** Optional media query the block is wrapped in. */
  media?: string;
  /** Emit `var(--…)` for references (true) or resolved values (false). */
  references: boolean;
  /** Output file, relative to the CSS output root, e.g. `variables/semantic.css`. */
  file: string;
}

export interface TypographyOptions {
  fontVariantNumeric?: {
    /** Path prefixes whose typography gets `font-variant-numeric: tabular-nums`. */
    tabular?: string[][];
  };
}

export interface RenderOptions {
  /** Prefix of every custom property and utility class, e.g. `ds-`. */
  prefix: string;
  /** Root font size that px values are divided by for rem. Default 16. */
  basePxFontSize: number;
  /** A path segment starting with one of these is private and never emitted. */
  privateTokenPrefixes: string[];
  typography: TypographyOptions;
}

/** Output file (relative to the CSS output root) → file content. */
export type RenderedFiles = Map<string, string>;

/**
 * Per-group reference behaviour, the shape the resolver config already has
 * (`themeGroups`, `defaultGroupBehavior`).
 */
export interface GroupBehavior {
  useReferences: boolean;
}

export interface RenderTableConfig {
  themeGroups?: Record<string, GroupBehavior>;
  defaultGroupBehavior?: GroupBehavior;
}

/** A token as a utility builder sees it. Settled in 3c (FOR-508). */
export interface RenderToken {
  path: string[];
  value: unknown;
  $type?: string;
}

export interface UtilityContext {
  tokens: RenderToken[];
  options: RenderOptions;
}

export interface UtilityOutput {
  filename: string;
  content: string;
}

/** A utility builder: tokens in, one CSS file out. */
export type UtilityBuilder = ((ctx: UtilityContext) => UtilityOutput | Promise<UtilityOutput>) & {
  builderName?: string;
};
