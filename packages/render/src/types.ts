import type { TokenSystem } from "@formtrieb/tokens-core";

/**
 * A token system as read from a Tokens-Studio export, already in memory —
 * core's `TokenSystem`. Reading it from disk is the caller's job; render
 * never touches a file.
 */
export type { TokenSystem };

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

/** What a length in px becomes. `source`: as written. Other units are never converted. */
export type UnitTarget = "rem" | "px" | "source";

/**
 * Which unit a length is written in, as data. A length in px is converted to
 * the target; a length written in another unit (`0.5rem`, `60ch`, `50%`,
 * `-0.03em`) stays as it is.
 */
export interface UnitPolicy {
  /**
   * Tokens Studio type → target. The token's own type is looked up first
   * (`spacing`), then its aligned type (`dimension`), so `{ dimension: "rem" }`
   * covers every length type not named itself. A type named nowhere: `source`.
   */
  types?: Record<string, UnitTarget>;
  /**
   * Path rules, checked before `types`; the first match wins. `match` is a
   * token's dot path in source casing (`zIndex.base`); `*` matches one
   * segment, `**` zero or more.
   */
  paths?: { match: string; unit: UnitTarget }[];
}

/** Named unit policies. `source`: nothing converted. `tokens-studio`: see {@link TOKENS_STUDIO_UNITS}. */
export type UnitPreset = "source" | "tokens-studio";

/**
 * How colours are written. `source`: literals as written. `rgb`: literals as
 * `rgb(r, g, b)` / `rgba(r, g, b, a)`. `hex`: every colour as `#rrggbb(aa)`.
 * A computed colour (a modifier's result) has no literal; it is
 * `rgb(r% g% b% / a)` under `source` and `rgb`, hex under `hex`.
 */
export type ColorForm = "source" | "rgb" | "hex";

export interface RenderOptions {
  /** Prefix of every custom property and utility class, e.g. `ds-`. */
  prefix: string;
  /** Unit policy or preset. Default `source`. */
  units?: UnitPolicy | UnitPreset;
  /** Root font size that px values are divided by for rem. Default 16. */
  basePxFontSize?: number;
  /** Default `source`. */
  color?: ColorForm;
  /**
   * Write a typography token's letter-spacing, text-transform,
   * text-decoration, text-indent and paragraph spacing as companion
   * variables next to the `font` shorthand (`--x-body-letter-spacing`, …),
   * which the `typography` builders read. Default false.
   */
  typographyCompanions?: boolean;
  /** A path segment starting with one of these is private and never emitted. Default `["*"]`. */
  privateTokenPrefixes?: string[];
  /** The tabular-numerals flag of typography companions. Default `{}`. */
  typography?: TypographyOptions;
}

/**
 * The output options a render file may carry. Only data: `typography` and
 * builders are code and stay with the caller.
 */
export type RenderFileOptions = Partial<Pick<RenderOptions, "prefix" | "units" | "basePxFontSize" | "color" | "typographyCompanions">>;

/**
 * A render file (`render.json`) as a producer writes it and a consumer reads
 * it: a bare list of rules, or the rules with the output options the tree
 * was written for. {@link parseRenderFile} reads either form.
 */
export type RenderFile = RenderRule[] | { options?: RenderFileOptions; rules: RenderRule[] };

/** {@link RenderOptions} with every default filled in and the unit preset expanded; what the render internals read. */
export type ResolvedRenderOptions = Required<Omit<RenderOptions, "units">> & { units: UnitPolicy };

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

/**
 * A token as a utility builder sees it: path, raw `$value`, raw `$type`.
 * The shape the CLI's builders have always received.
 */
export interface BuilderToken {
  path: string[];
  value: unknown;
  $type?: string;
  /** The token node as written ($value, $type, $extensions). */
  raw: Record<string, unknown>;
}

/** What a builder may read from the configuration. The resolver passes its whole config. */
export interface BuilderConfig {
  prefix: string;
}

export interface BuilderContext<C extends BuilderConfig = BuilderConfig> {
  tokens: BuilderToken[];
  config: C;
  /** Whether the variables carry typography companions; the `typography` builders need them. */
  typographyCompanions?: boolean;
}

export interface BuilderOutput {
  filename: string;
  content: string;
}

/** A utility builder: tokens in, one file out. */
export type BuilderFn<C extends BuilderConfig = BuilderConfig> = ((ctx: BuilderContext<C>) => BuilderOutput | Promise<BuilderOutput>) & {
  builderName?: string;
};
