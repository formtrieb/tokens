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
}

export interface Token {
  path: string[];
  value: unknown;
  $type?: string;
  /** Original token-tree node ($value, $type, $extensions) */
  raw: Record<string, unknown>;
}
