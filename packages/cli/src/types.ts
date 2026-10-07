import type {
  BuilderContext as RenderBuilderContext,
  BuilderFn as RenderBuilderFn,
  BuilderOutput,
  BuilderToken,
  ColorForm,
  GroupBehavior,
  RenderRule,
  TypographyOptions,
  UnitPolicy,
  UnitPreset,
} from '@formtrieb/tokens-render';

export type { BuilderOutput, BuilderToken, GroupBehavior, TypographyOptions };

export interface ConfigPaths {
  tokens: string;
  output: string;
  tokenMap: string;
}

export interface ConfigOutput {
  bundle?: boolean;
}

/** A utility builder as the CLI calls it: render's builder, handed the whole config. */
export type BuilderFn = RenderBuilderFn<Config>;
export type BuilderContext = RenderBuilderContext<Config>;

/** @deprecated The same as `BuilderToken`. */
export type Token = BuilderToken;
/** @deprecated The same as `TypographyOptions`. */
export type TypographyConfig = TypographyOptions;
/** @deprecated The same as `GroupBehavior`. */
export type ThemeGroupBehavior = GroupBehavior;

export interface Config {
  prefix: string;
  paths: ConfigPaths;
  output?: ConfigOutput;
  privateTokenPrefixes?: string[];
  themeGroups?: Record<string, GroupBehavior>;
  defaultGroupBehavior?: GroupBehavior;
  utilities?: BuilderFn[];
  typography?: TypographyOptions;
  /** Root font size px are divided by for rem. Overrides the render file. Default 16. */
  basePxFontSize?: number;
  /**
   * Unit policy, see `@formtrieb/tokens-render`: a preset name or
   * `{ types?, paths? }`. Overrides the render file. Default `'tokens-studio'`.
   */
  units?: UnitPolicy | UnitPreset;
  /** `'source'`, `'rgb'` or `'hex'`. Overrides the render file. Default `'rgb'`. */
  color?: ColorForm;
  /** Typography companion variables, which the typography builders read. Overrides the render file. Default true. */
  typographyCompanions?: boolean;
  /**
   * The render table: which theme is written to which file under which
   * selector. Rules, or a path to a render file: a JSON list of rules, or
   * `{ options?, rules }` with the output options the tree was written for.
   * Default: derived from `$themes.json`, `themeGroups` and
   * `defaultGroupBehavior`.
   */
  render?: RenderRule[] | string;
}
