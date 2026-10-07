import type { ColorModifier, ThemeDefinition } from "../types.js";

/**
 * A Tokens-Studio export in memory. Reading it from disk is the caller's job;
 * {@link buildTokenSystem} turns the files into one.
 */
export interface TokenSystem {
  /**
   * Set names in the order sets are known: `$metadata.json` first, then sets
   * a theme names, then every other set file by path. Only sets that exist.
   */
  order: string[];
  /** Set name → parsed JSON of that set. */
  sets: ReadonlyMap<string, Record<string, unknown>>;
  /** `$themes.json`, parsed with `parseThemes`. */
  themes: ThemeDefinition[];
}

/**
 * Which sets a composition reads, in order. `source` sets resolve references,
 * `enabled` sets are also written. A list, not an object: object keys that
 * look like integers would be reordered.
 */
export type SetSelection = ReadonlyArray<{ set: string; state: "source" | "enabled" }>;

/** One token of a composed theme. */
export interface DictionaryEntry {
  /** Dot path, `colors.neutral.1`. */
  key: string;
  path: string[];
  /** Tokens Studio type, own or inherited from a group (`fontSizes`, `letterSpacing`, …). */
  type?: string;
  /** The type the meaning rules key on (`fontSize`, `dimension`, …), see `alignType`. */
  alignedType?: string;
  /** `$value` as written. */
  value: unknown;
  extensions?: Record<string, unknown>;
  description?: string;
  /** The set the token comes from. */
  set: string;
  /** From an `enabled` set: the theme writes this token. */
  emitted: boolean;
}

export interface Dictionary {
  /** In the order of the merged tree; a key keeps the position it first had. */
  entries: DictionaryEntry[];
  byKey: ReadonlyMap<string, DictionaryEntry>;
  /** Dot paths of groups, so a reference to a group is told apart from one to nothing. */
  groups: ReadonlySet<string>;
  problems: TokenProblem[];
}

/** A colour as culori holds it: unrounded, not gamut-mapped. */
export interface Color {
  mode: string;
  alpha?: number;
  [channel: string]: number | string | undefined;
}

export interface ShadowLayer {
  inset: boolean;
  offsetX: TokenValue;
  offsetY: TokenValue;
  blur: TokenValue;
  spread: TokenValue;
  color: TokenValue;
}

/** Arithmetic that cannot be reduced, e.g. `80rem - 1px`. Leaves are lengths and numbers. */
export type Expr = { op: "+" | "-" | "*" | "/"; left: Expr; right: Expr } | TokenValue;

/** What a token means, independent of any output format. */
export type TokenValue =
  /** `8px`, `0.5rem`, `60ch`, `-0.03em`, `50%`; a bare number in a length type is px. */
  | { kind: "length"; value: number; unit: string }
  | { kind: "number"; value: number }
  /**
   * `literal` as written (references replaced); `color` parsed or computed,
   * absent when the literal is no colour culori reads (gradients, system
   * colours). A modifier's result has no literal.
   */
  | { kind: "color"; literal?: string; color?: Color; outOfGamut?: boolean }
  | { kind: "fontWeight"; value: number; style?: "italic" | "oblique" }
  | { kind: "fontFamily"; families: string[] }
  | { kind: "duration"; value: number; unit: "ms" | "s" }
  | { kind: "cubicBezier"; points: [number, number, number, number] }
  | { kind: "string"; value: string }
  /** Space-separated values, `0 4px 8px`. */
  | { kind: "list"; items: TokenValue[] }
  | { kind: "expression"; expr: Expr }
  | {
      kind: "typography";
      fontFamily?: TokenValue;
      fontWeight?: TokenValue;
      fontSize?: TokenValue;
      lineHeight?: TokenValue;
      letterSpacing?: TokenValue;
      paragraphSpacing?: TokenValue;
      paragraphIndent?: TokenValue;
      textCase?: TokenValue;
      textDecoration?: TokenValue;
    }
  | { kind: "shadow"; layers: ShadowLayer[] }
  | { kind: "border"; width?: TokenValue; style?: TokenValue; color?: TokenValue }
  | { kind: "transition"; duration?: TokenValue; delay?: TokenValue; timingFunction?: TokenValue }
  /** A reference without target, or one closing a cycle: the text stays as it was. */
  | { kind: "unresolved"; text: string }
  /** A value no rule reads (an object of an unknown type, a boolean, …). */
  | { kind: "raw"; value: unknown };

export type TokenProblem =
  | { kind: "unknown-reference"; path: string; reference: string }
  | { kind: "group-reference"; path: string; reference: string }
  | { kind: "cycle"; path: string; cycle: string[] }
  | { kind: "untyped-token"; path: string; set: string }
  | { kind: "invalid-value"; path: string; type: string; value: unknown; reason: string }
  | { kind: "node-conflict"; path: string; set: string }
  | { kind: "missing-set"; set: string };

/** One token visited while resolving: what it holds as written, and where it comes from. */
export interface ChainStep {
  key: string;
  set: string;
  value: unknown;
  modify?: ColorModifier;
}

export interface Resolution {
  key: string;
  value: TokenValue;
  /** Every token visited, the resolved one first, in visiting order, each once. */
  chain: ChainStep[];
  /** Problems of this token and of every token in its chain. */
  problems: TokenProblem[];
}
