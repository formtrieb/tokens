import type { Dialect, RenderRule } from '@formtrieb/tokens-render';

export interface ThemeGroupBehavior {
  useReferences: boolean;
}

export interface ConfigPaths {
  tokens: string;
  output: string;
  tokenMap: string;
}

export interface ConfigOutput {
  bundle?: boolean;
}

export interface BuilderContext {
  tokens: Token[];
  config: Config;
}

export interface BuilderOutput {
  filename: string;
  content: string;
}

export type BuilderFn = ((ctx: BuilderContext) => BuilderOutput | Promise<BuilderOutput>) & {
  builderName?: string;
};

export interface TypographyConfig {
  fontVariantNumeric?: {
    tabular?: string[][];
  };
}

export interface Config {
  prefix: string;
  paths: ConfigPaths;
  output?: ConfigOutput;
  privateTokenPrefixes?: string[];
  themeGroups?: Record<string, ThemeGroupBehavior>;
  defaultGroupBehavior?: ThemeGroupBehavior;
  utilities?: BuilderFn[];
  typography?: TypographyConfig;
  /**
   * Output dialect, see `@formtrieb/tokens-render`. Overrides the render
   * file's `options.dialect`. Default `'style-dictionary'`.
   */
  dialect?: Dialect;
  /** Root font size px are divided by for rem. Overrides the render file. Default 16. */
  basePxFontSize?: number;
  /** `'rem'` or `'source'`. Overrides the render file. Default from the dialect. */
  units?: 'rem' | 'source';
  /** `'rgb'` or `'source'`. Overrides the render file. Default from the dialect. */
  color?: 'rgb' | 'source';
  /**
   * The render table: which theme is written to which file under which
   * selector. Rules, or a path to a render file: a JSON list of rules, or
   * `{ options?, rules }` with the output options the tree was written for.
   * Default: derived from `$themes.json`, `themeGroups` and
   * `defaultGroupBehavior`.
   */
  render?: RenderRule[] | string;
}

export interface Token {
  path: string[];
  value: unknown;
  $type?: string;
  /** Original token-tree node ($value, $type, $extensions) */
  raw: Record<string, unknown>;
}
