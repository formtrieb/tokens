/**
 * The two machines, each driven exactly the way its real consumer drives it.
 *
 * core:  what `@formtrieb/tokens-mcp` does in `resolve_token` — load the sets,
 *        compose the theme, resolve through `ReferenceResolver`.
 * sd:    what `@formtrieb/token-resolver` does in `buildTheme` — same source /
 *        include split, same preprocessor, same transform list — but read
 *        through `getPlatformTokens` so we get the transformed value per token
 *        instead of having to parse CSS.
 *
 * Both read one theme at a time, because that is the unit the resolver emits:
 * one theme, one CSS block.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import StyleDictionary from 'style-dictionary';
import {
  TokenTree,
  ReferenceResolver,
  parseThemes,
  type ThemeDefinition,
} from '@formtrieb/tokens-core';
// Internal module of the resolver: exports the transform list and, on import,
// registers sd-transforms + the `isSource` filter on the shared StyleDictionary.
import { TRANSFORMS, TRANSFORM_GROUP } from '../../packages/resolver/src/build/style-dictionary.js';

export interface TokenSystem {
  dir: string;
  order: string[];
  sets: Map<string, Record<string, unknown>>;
  themes: ThemeDefinition[];
}

export interface Reading {
  value: unknown;
  type?: string;
  errors?: string[];
}

/** dot-path → reading */
export type Readings = Map<string, Reading>;

export function loadTokenSystem(dir: string): TokenSystem {
  const metadata = JSON.parse(readFileSync(join(dir, '$metadata.json'), 'utf-8'));
  const order: string[] = metadata.tokenSetOrder;
  const sets = new Map<string, Record<string, unknown>>();
  for (const name of order) {
    const file = join(dir, ...name.split('/')) + '.json';
    if (existsSync(file)) sets.set(name, JSON.parse(readFileSync(file, 'utf-8')));
  }
  const themes = parseThemes(JSON.parse(readFileSync(join(dir, '$themes.json'), 'utf-8')));
  return { dir, order, sets, themes };
}

export function themeId(theme: ThemeDefinition): string {
  return `${theme.group}/${theme.name}`;
}

export function activeSets(theme: ThemeDefinition): { enabled: string[]; source: string[] } {
  const enabled: string[] = [];
  const source: string[] = [];
  for (const [set, state] of Object.entries(theme.selectedTokenSets)) {
    if (state === 'enabled') enabled.push(set);
    else if (state === 'source') source.push(set);
  }
  return { enabled, source };
}

/** The resolver's default: a path segment starting with `*` is private and never emitted. */
export function isPrivate(dotPath: string): boolean {
  return dotPath.split('.').some((segment) => segment.startsWith('*'));
}

export function readWithCore(system: TokenSystem, theme: ThemeDefinition): Readings {
  const tree = new TokenTree(system.sets, system.order);
  const { enabled, source } = activeSets(theme);
  const merged = tree.buildMergedTree(enabled, source);
  const resolver = new ReferenceResolver(merged);

  const readings: Readings = new Map();
  for (const [dotPath, token] of merged) {
    if (token.isSource || isPrivate(dotPath)) continue;
    const chain = resolver.resolve(dotPath);
    readings.set(dotPath, {
      value: chain.finalValue,
      type: token.$type,
      ...(chain.errors.length > 0 && { errors: chain.errors }),
    });
  }
  return readings;
}

export async function readWithStyleDictionary(
  system: TokenSystem,
  theme: ThemeDefinition
): Promise<Readings> {
  const { enabled, source } = activeSets(theme);
  const sd = new StyleDictionary({
    log: { warnings: 'disabled', verbosity: 'silent', errors: { brokenReferences: 'console' } },
    source: enabled.map((set) => `${system.dir}/${set}.json`),
    include: source.map((set) => `${system.dir}/${set}.json`),
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        prefix: 'x-',
        transformGroup: TRANSFORM_GROUP,
        transforms: TRANSFORMS,
      },
    },
  });
  await sd.hasInitialized;
  const dictionary = await sd.getPlatformTokens('css');

  const readings: Readings = new Map();
  for (const token of dictionary.allTokens) {
    if (!token.isSource) continue;
    const dotPath = token.path.join('.');
    if (isPrivate(dotPath)) continue;
    readings.set(dotPath, {
      value: token.$value ?? token.value,
      type: token.$type ?? token.type,
    });
  }
  return readings;
}
